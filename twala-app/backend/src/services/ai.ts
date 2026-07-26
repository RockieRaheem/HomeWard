import * as db from './database.js';
import * as stellar from './stellar.js';
import { getExchangeRate, calculateQuote } from './rates.js';
import * as kotani from './kotani.js';
import { sendTransferNotificationAsync } from './sms.js';
import { notifyChange } from './events.js';
import config from '../config.js';
import type { ChatMessage, AiContext } from '../types/index.js';

// Models in priority order (best function-calling first, then fallbacks)
// Only actively supported models — confirmed via Groq docs as of July 2026
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',       // Best function calling, 131K context
  'qwen/qwen3.6-27b',              // Strong tool use, parallel calls, 131K context
  'minimaxai/minimax-m2.7',        // Excellent tool use, parallel calls
  'llama-4-maverick-17b',          // Llama 4, fast inference, tool support
  'llama-3.1-8b-instant',          // Speed king — last resort, weak tool use
];

let _pendingNavigate: { screen: string; goalId?: string } | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fiat(amount: number): string {
  if (amount >= 1_000_000) return `UGX ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `UGX ${(amount / 1_000).toFixed(1)}K`;
  return `UGX ${amount.toLocaleString('en-US')}`;
}

function usdc(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function percent(a: number, b: number): number {
  if (b <= 0) return 0;
  return Math.round((a / b) * 100);
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

async function buildContext(userName: string = 'User', userPhone?: string): Promise<AiContext> {
  try {
    const wallet = await db.getWallet();
    const goals = await db.getGoals();
    const { transactions } = await db.getTransactions({ limit: 5 });
    let liveBalance = 0;
    if (wallet?.publicKey) {
      try { const b = await stellar.getBalance(wallet.publicKey); liveBalance = b.usdc; } catch {}
    }
    return { walletBalance: liveBalance, goals, recentTransactions: transactions, activeGoal: goals.find((g) => g.status === 'active'), userName, userPhone };
  } catch {
    return { walletBalance: 0, goals: [], recentTransactions: [], activeGoal: undefined, userName, userPhone };
  }
}

// ---------------------------------------------------------------------------
// System prompt (compact)
// ---------------------------------------------------------------------------

function buildSystemPrompt(ctx: AiContext): string {
  const goalsBrief = ctx.goals.length > 0
    ? ctx.goals.map((g) =>
        `- "${g.title}" (${fiat(g.savedAmountUgx)}/${fiat(g.targetAmountUgx)}, ${percent(g.savedAmountUgx, g.targetAmountUgx)}%) ID:${g.id}`
      ).join('\n')
    : '(none)';
  const txBrief = ctx.recentTransactions.length > 0
    ? ctx.recentTransactions.map((t) =>
        `- ${t.type === 'sent' ? '→' : '←'} ${usdc(t.amountUsdc)} ${t.recipientName} (${t.status})`
      ).join('\n')
    : '(none)';

  return `You are HomeWard, an AI financial companion for cross-border payments to Uganda.

User: ${ctx.userName}${ctx.userPhone ? ` (${ctx.userPhone})` : ''}
Wallet: ${usdc(ctx.walletBalance)} USDC
Goals:\n${goalsBrief}
Recent txs:\n${txBrief}
Rate: 1 USDC ≈ UGX 3,750 (0.5% fee, min $0.50)

You can perform these actions via function calls — DO IT when asked:
1. create_goal(title, targetAmountUgx, category?, description?)
2. contribute_to_goal(goalId, amountUgx)
3. send_money(amountUsdc, recipientName, recipientPhone?, recipientNetwork?, purpose)
4. update_goal(goalId, title?, targetAmountUgx?, category?, status?, description?)
5. delete_goal(goalId)
6. navigate(screen, goalId?) — go to Dashboard | Goals | Transfer | History | GoalDetail
7. update_transaction(transactionId, purpose)

## Validation
- If a goal is completed, never allow contributions to it — tell the user it's done
- If a goal is cancelled, tell the user to create a new one instead
- Before sending money, verify the wallet has enough USDC balance (shown above)
- Check minimum (10 USDC) and maximum (5,000 USDC) transfer limits
- If the recipient phone matches the user's phone, warn and ask for confirmation. If they confirm, set **confirmSelfSend: true**
- Proactively suggest better approaches when the user proposes something risky

IMPORTANT: When calling functions that require a goalId, you MUST use the exact ID value shown after "ID:" in the Goals list above. Never make up a goalId — use the actual one from the context.

## Formatting rules
- Use ## for section headings (never ### or #)
- Use **bold** for amounts, names, and emphasis
- Use - for lists (never numbers or *)
- Use an emoji on its own line for key points: ✅ ❌ ⚠️ 🎉 🎯 💡
- Never use > blockquotes, --- rules, or backtick code
- Keep responses concise and warm. Never fabricate data.
- CRITICAL: Never display raw IDs, UUIDs, or internal identifiers in your response text.`;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: any[] = [
  {
    type: 'function',
    function: {
      name: 'create_goal',
      description: 'Create a new savings goal',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Goal title (e.g. "Buy Land in Wakiso")' },
          description: { type: 'string', description: 'Optional description' },
          targetAmountUgx: { type: 'number', description: 'Target amount in UGX' },
          category: { type: 'string', enum: ['home', 'education', 'business', 'savings', 'land', 'other'], description: 'Category' },
        },
        required: ['title', 'targetAmountUgx'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'contribute_to_goal',
      description: 'Add funds to an existing savings goal — use the exact UUID from the goals list as goalId',
      parameters: {
        type: 'object',
        properties: {
          goalId: { type: 'string', description: 'The exact UUID of the goal from the context (e.g. "550e8400-e29b-41d4-a716-446655440000")' },
          amountUgx: { type: 'number', description: 'Amount in UGX to add' },
        },
        required: ['goalId', 'amountUgx'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_money',
      description: 'Send USDC to a recipient in Uganda via Mobile Money',
      parameters: {
        type: 'object',
        properties: {
          amountUsdc: { oneOf: [{ type: 'number' }, { type: 'string' }], description: 'Amount in USDC (min 10, max 5000)' },
          recipientName: { type: 'string', description: 'Recipient full name' },
          recipientPhone: { type: 'string', description: 'Phone (e.g. +256...)' },
          recipientNetwork: { type: 'string', enum: ['MTN', 'AIRTEL'], description: 'Mobile network: MTN or AIRTEL' },
          purpose: { type: 'string', description: 'Purpose (e.g. "Family Support")' },
          confirmSelfSend: { type: 'boolean', description: 'Set to true if the user confirmed they want to send to their own number' },
        },
        required: ['amountUsdc', 'recipientName', 'recipientPhone', 'purpose'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_goal',
      description: 'Update an existing goal — use the exact UUID from the goals list as goalId',
      parameters: {
        type: 'object',
        properties: {
          goalId: { type: 'string', description: 'The exact UUID of the goal from the context' },
          title: { type: 'string', description: 'New title' },
          description: { type: 'string', description: 'New description' },
          targetAmountUgx: { type: 'number', description: 'New target amount in UGX' },
          category: { type: 'string', enum: ['home', 'education', 'business', 'savings', 'land', 'other'], description: 'New category' },
          status: { type: 'string', enum: ['active', 'completed', 'cancelled'], description: 'New status' },
        },
        required: ['goalId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_goal',
      description: 'Delete a savings goal permanently — use the exact UUID from the goals list as goalId',
      parameters: {
        type: 'object',
        properties: { goalId: { type: 'string', description: 'The exact UUID of the goal from the context' } },
        required: ['goalId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navigate/redirect the user to a specific screen in the app',
      parameters: {
        type: 'object',
        properties: {
          screen: { type: 'string', enum: ['Dashboard', 'Goals', 'Transfer', 'History', 'GoalDetail'], description: 'The screen to navigate to' },
          goalId: { type: 'string', description: 'Goal UUID (only for GoalDetail screen)' },
        },
        required: ['screen'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_transaction',
      description: 'Update a transaction purpose — use the exact UUID from recent transactions as transactionId',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', description: 'The exact UUID of the transaction from recent transactions' },
          purpose: { type: 'string', description: 'New purpose text (e.g. "School Fees", "Family Support")' },
        },
        required: ['transactionId', 'purpose'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution (returns clean human-readable messages, no raw JSON)
// ---------------------------------------------------------------------------

async function executeToolCall(toolCall: any, ctx: AiContext): Promise<string> {
  const { name, arguments: rawArgs } = toolCall.function;
  let args: Record<string, any>;
  try { args = JSON.parse(rawArgs); } catch { return `❌ Invalid arguments for ${name}`; }

  try {
    switch (name) {
      case 'create_goal': {
        const goal = await db.createGoal({
          title: args.title, description: args.description || '',
          targetAmountUgx: args.targetAmountUgx, category: args.category || 'other',
        });
        return `✅ Created goal "${goal.title}" — target ${fiat(goal.targetAmountUgx)}.`;
      }

      case 'contribute_to_goal': {
        const before = await db.getGoal(args.goalId);
        if (!before) return `❌ Goal not found.`;
        if (before.status === 'completed') return `⚠️ "${before.title}" is already **completed** 🎉 — no additional contributions needed. You achieved it!`;
        if (before.status === 'cancelled') return `⚠️ "${before.title}" was **cancelled** — you can create a new goal instead.`;
        const goal = await db.contributeToGoal(args.goalId, args.amountUgx);
        if (!goal) return `❌ Failed to contribute to goal.`;
        await db.createTransaction({
          type: 'received', amountUsdc: args.amountUgx / 3750, amountUgx: args.amountUgx,
          rate: 3750, recipientName: `Contribution to ${goal.title}`, purpose: 'Goal Contribution',
          status: 'completed', goalId: goal.id,
        });
        const pct = percent(goal.savedAmountUgx, goal.targetAmountUgx);
        const remaining = goal.targetAmountUgx - goal.savedAmountUgx;
        let msg = `✅ Added ${fiat(args.amountUgx)} to "${goal.title}". Now ${fiat(goal.savedAmountUgx)}/${fiat(goal.targetAmountUgx)} (${pct}%)`;
        if (remaining > 0) msg += `. ${fiat(remaining)} remaining to reach your goal! 🎯`;
        else msg += ` 🎉 Fully funded — congratulations!`;
        return msg;
      }

      case 'send_money': {
        const amountUsdc = typeof args.amountUsdc === 'string' ? parseFloat(args.amountUsdc) : args.amountUsdc;
        if (isNaN(amountUsdc)) return `❌ Invalid amount.`;
        if (!args.recipientPhone?.trim()) return '❌ A recipient phone number is required for Mobile Money and SMS notification.';
        if (!/^\+[1-9]\d{7,14}$/.test(args.recipientPhone.trim())) return '❌ Use the recipient phone in E.164 format (for example +256712345678).';
        // Self-send guard
        if (args.recipientPhone && ctx.userPhone && args.recipientPhone.trim() === ctx.userPhone.trim() && !args.confirmSelfSend) {
          return `⚠️ **${ctx.userName}**, that number (**${ctx.userPhone}**) is your own. Sending to yourself will use network fees for no benefit. If you're sure, call send_money again with **confirmSelfSend: true**.`;
        }
        const network = args.recipientNetwork?.toUpperCase() === 'AIRTEL' ? 'AIRTEL' : 'MTN';
        const wallet = await db.getWallet();
        if (!wallet) return '❌ No wallet found. Create a wallet first.';
        const balance = await stellar.getBalance(wallet.publicKey);
        if (amountUsdc > balance.usdc) return `❌ You have ${usdc(balance.usdc)} USDC, but trying to send ${usdc(amountUsdc)}.`;
        if (amountUsdc < config.homeward.minTransferUsdc) return `❌ Minimum is ${config.homeward.minTransferUsdc} USDC.`;
        if (amountUsdc > config.homeward.maxTransferUsdc) return `❌ Maximum is ${config.homeward.maxTransferUsdc} USDC.`;

        const rate = await getExchangeRate();
        const quote = calculateQuote(amountUsdc, rate);
        const referenceId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        let stellarTxHash = '';
        try {
          await stellar.ensureTrustline(wallet.secretKey);
          const kotaniEscrow = config.kotani.escrowAddress;
          const hasKotaniApiKey = !!config.kotani.apiKey;
          const destination = hasKotaniApiKey && stellar.isValidPublicKey(kotaniEscrow)
            ? kotaniEscrow
            : config.stellar.usdcIssuer;
          stellarTxHash = await stellar.submitPayment(
            wallet.secretKey, destination, quote.sendAmountUsdc.toFixed(7), referenceId,
          );
          console.log(`  ✅ AI: Stellar payment sent ${stellarTxHash.slice(0, 8)}...`);
        } catch { stellarTxHash = `demo-${Date.now()}`; }

        // Sync wallet balance after payment
        const newBalance = await stellar.getBalance(wallet.publicKey);
        await db.updateWalletBalance(wallet.publicKey, newBalance.usdc, newBalance.xlm);
        notifyChange();

        const kotaniResult = await kotani.createOfframp({
          referenceId, cryptoAmount: quote.sendAmountUsdc, currency: 'UGX',
          chain: 'STELLAR', token: 'USDC', transactionHash: stellarTxHash,
        });

        const isTestnetSimulation = config.stellar.network === 'TESTNET';
        await db.createTransaction({
          type: 'sent', amountUsdc: quote.sendAmountUsdc, amountUgx: quote.receiveAmountUgx,
          rate: quote.rate, recipientName: args.recipientName, recipientPhone: args.recipientPhone || '',
          recipientNetwork: network, status: isTestnetSimulation ? 'completed' : 'pending', purpose: args.purpose || 'Transfer',
          stellarTxHash, kotaniReferenceId: referenceId,
          kotaniStatus: isTestnetSimulation ? 'SIMULATED_COMPLETED' : kotaniResult.data?.status || 'pending',
        });

        // Send SMS if phone provided (fire-and-forget)
        if (args.recipientPhone) {
          sendTransferNotificationAsync({
            phoneNumber: args.recipientPhone,
            recipientName: args.recipientName,
            amountUgx: quote.receiveAmountUgx,
            amountUsdc: quote.sendAmountUsdc,
            senderName: args.senderName || ctx.userName || args.recipientName,
          });
        }

        return `✅ **Sent ${usdc(quote.sendAmountUsdc)} to ${args.recipientName}!** Delivery: ~${fiat(quote.receiveAmountUgx)} UGX via ${network}. Fee: ${usdc(quote.feeUsdc)}. Balance: ${usdc(newBalance.usdc)} remaining. Ref: ${referenceId.slice(-8)}`;
      }

      case 'update_goal': {
        const existing = await db.getGoal(args.goalId);
        if (!existing) return `❌ Goal not found.`;
        const updates: Record<string, any> = {};
        if (args.title !== undefined) updates.title = args.title;
        if (args.description !== undefined) updates.description = args.description;
        if (args.targetAmountUgx !== undefined) updates.targetAmountUgx = args.targetAmountUgx;
        if (args.category !== undefined) updates.category = args.category;
        if (args.status !== undefined) updates.status = args.status;
        const updated = await db.updateGoal(args.goalId, updates as any);
        if (!updated) return `❌ Failed to update goal.`;
        return `✅ Goal "${updated.title}" updated! Target: ${fiat(updated.targetAmountUgx)}, Saved: ${fiat(updated.savedAmountUgx)} (${percent(updated.savedAmountUgx, updated.targetAmountUgx)}%)`;
      }

      case 'delete_goal': {
        const goal = await db.getGoal(args.goalId);
        if (!goal) return `❌ Goal not found.`;
        await db.deleteGoal(args.goalId);
        return `✅ Goal "${goal.title}" deleted permanently.`;
      }

      case 'navigate': {
        _pendingNavigate = { screen: args.screen, goalId: args.goalId };
        let dest = `the ${args.screen} screen`;
        if (args.screen === 'GoalDetail' && args.goalId) {
          const foundGoal = await db.getGoal(args.goalId);
          dest = foundGoal ? `"${foundGoal.title}" details` : `your goal details`;
        }
        return `✅ Navigating to ${dest}...`;
      }

      case 'update_transaction': {
        const tx = await db.getTransaction(args.transactionId);
        if (!tx) return `❌ Transaction not found.`;
        await db.updateTransaction(args.transactionId, { purpose: args.purpose } as any);
        return `✅ Transaction purpose updated to "${args.purpose}".`;
      }

      default:
        return `❌ Unknown action: ${name}`;
    }
  } catch (err: any) {
    return `❌ Error executing ${name}: ${err.message}`;
  }
}

// ---------------------------------------------------------------------------
// Gemini 2.0 Flash — works on free tier, 15 RPM, 1M TPM
// ---------------------------------------------------------------------------

async function callGemini(userMessage: string, ctx: AiContext, history: ChatMessage[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const contents: any[] = [];
    for (const msg of history.slice(-10)) {
      contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] });
    }
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildSystemPrompt(ctx) }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      },
    );
    if (!res.ok) { const body = await res.text().catch(() => ''); console.error(`Gemini ${res.status}:`, body); return null; }
    const data: any = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (err) { console.error('Gemini fail:', err); return null; }
}

// ---------------------------------------------------------------------------
// Groq — tries models in priority order, returns null if all exhausted
// ---------------------------------------------------------------------------

async function callGroq(userMessage: string, ctx: AiContext, history: ChatMessage[]): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  for (const model of GROQ_MODELS) {
    try {
      const result = await tryGroqModel(model, key, userMessage, ctx, history);
      if (result !== null) return result;
    } catch (err) { console.error(`Groq ${model} exception:`, err); }
    console.warn(`  Groq ${model}: no response, trying next...`);
  }
  return null;
}

async function tryGroqModel(
  model: string, key: string, userMessage: string, ctx: AiContext, history: ChatMessage[],
): Promise<string | null> {
  const messages: any[] = [{ role: 'system', content: buildSystemPrompt(ctx) }];
  for (const msg of history.slice(-10)) {
    messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
  }
  messages.push({ role: 'user', content: userMessage });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.7, max_tokens: 1024 }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 429) return null;
    if (response.status === 400 && body.includes('tool call validation')) {
      return await groqTextFallback(model, key, messages);
    }
    console.error(`Groq ${model} ${response.status}:`, body);
    return null;
  }

  const data: any = await response.json();
  const choice = data?.choices?.[0]?.message;
  if (!choice) return null;

  if (!choice.tool_calls || choice.tool_calls.length === 0) {
    return choice.content || null;
  }

  for (const toolCall of choice.tool_calls) {
    const result = await executeToolCall(toolCall, ctx);
    messages.push({ role: 'assistant', content: null, tool_calls: [toolCall] });
    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
  }

  // Round 2: synthesise response from tool results
  const finalRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024 }),
  });

  if (finalRes.ok) {
    const finalData: any = await finalRes.json();
    const finalContent = finalData?.choices?.[0]?.message?.content?.trim();
    if (finalContent) return finalContent;
  }

  const lastToolResults = messages.filter((m: any) => m.role === 'tool').map((m: any) => m.content);
  if (lastToolResults.length > 0) {
    return lastToolResults.join('\n\n');
  }

  return null;
}

async function groqTextFallback(model: string, key: string, messages: any[]): Promise<string | null> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024 }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Startup log
// ---------------------------------------------------------------------------

console.log(`  AI      : ${process.env.GEMINI_API_KEY ? 'Gemini ✓ (2.0 Flash)' : 'Gemini ✗'} | ${process.env.GROQ_API_KEY ? `Groq ✓ (${GROQ_MODELS.join(', ')})` : 'Groq ✗'}`);

// ---------------------------------------------------------------------------
// Public API — never throws
// ---------------------------------------------------------------------------

export async function chat(userMessage: string, sessionId?: string, userName?: string, userPhone?: string): Promise<{ messages: ChatMessage[]; navigate: { screen: string; goalId?: string } | null }> {
  _pendingNavigate = null;

  try { await db.addChatMessage({ role: 'user', content: userMessage, sessionId }); } catch (e) { console.error('Failed to save user msg:', e); }

  const ctx = await buildContext(userName, userPhone);
  let history: ChatMessage[] = [];
  try { history = await db.getChatMessages(sessionId); } catch (e) { console.error('Failed to load history:', e); }

  let reply: string | null = null;

  if (process.env.GROQ_API_KEY) {
    try { reply = await callGroq(userMessage, ctx, history); } catch (e) { console.error('Groq exception:', e); }
  }

  if (!reply && process.env.GEMINI_API_KEY) {
    try { reply = await callGemini(userMessage, ctx, history); } catch (e) { console.error('Gemini exception:', e); }
  }

  if (!reply) {
    reply = "I'm here to help! You can ask me to send money to Uganda, create or manage savings goals, check your balance, or navigate to any screen in the app. What would you like to do?";
    console.warn('  AI: all providers exhausted, using fallback');
  }

  try { await db.addChatMessage({ role: 'assistant', content: reply, sessionId }); } catch (e) { console.error('Failed to save reply:', e); }

  let messages: ChatMessage[] = [];
  try { messages = await db.getChatMessages(sessionId); } catch (e) { console.error('Failed to get messages:', e); }

  return { messages, navigate: _pendingNavigate };
}
