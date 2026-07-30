import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { WalletInfo, Transaction, Goal, ChatMessage, ChatSession, ExchangeRate, UserProfile, AppNotification, Recipient, RecipientPassport, Circle } from '../types/index.js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

let _db: SupabaseClient | null = null;
const userContext = new AsyncLocalStorage<string>();

export function runForUser<T>(userId: string, work: () => T): T { return userContext.run(userId, work); }
function currentUserId(): string | null { return userContext.getStore() || null; }
function requireUserId(): string { const id = currentUserId(); if (!id) throw new Error('Authenticated user required'); return id; }
export function getCurrentUserId(): string { return requireUserId(); }

function db(): SupabaseClient {
  if (!_db) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
    }
    _db = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
    console.log('  ✅ Supabase connected');
  }
  return _db!;
}

function checkError(error: PostgrestError | null, context: string) {
  if (error) {
    throw new Error(`DB ${context}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export async function getWallet(): Promise<WalletInfo | null> {
  let query = db()
    .from('wallets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { data, error } = await query.single();

  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'getWallet');
  if (!data) return null;

  return {
    publicKey: data.public_key,
    secretKey: data.secret_key,
    balanceUsdc: Number(data.balance_usdc || 0),
    balanceXlm: Number(data.balance_xlm || 0),
    isFunded: data.is_funded,
  };
}

export async function updateWalletBalance(publicKey: string, balanceUsdc: number, balanceXlm: number): Promise<void> {
  let query = db()
    .from('wallets')
    .update({ balance_usdc: balanceUsdc.toFixed(7), balance_xlm: balanceXlm.toFixed(7), updated_at: new Date().toISOString() })
    .eq('public_key', publicKey);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { error } = await query;
  checkError(error, 'updateWalletBalance');
}

export async function saveWallet(wallet: WalletInfo): Promise<void> {
  const userId = requireUserId();
  const { error: delErr } = await db().from('wallets').delete().eq('user_id', userId);
  checkError(delErr, 'saveWallet (delete)');

  const { error: insErr } = await db().from('wallets').insert({
    user_id: userId,
    public_key: wallet.publicKey,
    secret_key: wallet.secretKey,
    is_funded: wallet.isFunded,
    balance_usdc: wallet.balanceUsdc.toFixed(7),
    balance_xlm: wallet.balanceXlm.toFixed(7),
  });
  checkError(insErr, 'saveWallet (insert)');
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export async function getGoals(): Promise<Goal[]> {
  let query = db()
    .from('goals')
    .select('*')
    .order('created_at', { ascending: false });
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { data, error } = await query;

  checkError(error, 'getGoals');
  return (data || []).map(goalRow);
}

export async function getGoal(id: string): Promise<Goal | null> {
  let query = db()
    .from('goals')
    .select('*')
    .eq('id', id);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { data, error } = await query.single();

  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'getGoal');
  return data ? goalRow(data) : null;
}

export async function createGoal(input: {
  title: string;
  description?: string;
  targetAmountUgx: number;
  targetDate?: string;
  category?: string;
  milestones?: any[];
}): Promise<Goal> {
  const { data, error } = await db()
    .from('goals')
    .insert({
      user_id: requireUserId(),
      title: input.title,
      description: input.description || '',
      target_amount_ugx: input.targetAmountUgx,
      target_date: input.targetDate || null,
      category: input.category || 'other',
      milestones: input.milestones || [],
    })
    .select()
    .single();

  checkError(error, 'createGoal');
  if (!data) throw new Error('Failed to create goal');
  return goalRow(data);
}

export async function deleteGoal(id: string): Promise<void> {
  let query = db().from('goals').delete().eq('id', id);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { error } = await query;
  checkError(error, 'deleteGoal');
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | null> {
  const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.targetAmountUgx !== undefined) dbUpdates.target_amount_ugx = updates.targetAmountUgx;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.savedAmountUgx !== undefined) dbUpdates.saved_amount_ugx = updates.savedAmountUgx;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.milestones !== undefined) dbUpdates.milestones = updates.milestones;

  let query = db()
    .from('goals')
    .update(dbUpdates)
    .eq('id', id);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { data, error } = await query.select().single();

  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'updateGoal');
  return data ? goalRow(data) : null;
}

export async function contributeToGoal(id: string, amountUgx: number): Promise<Goal | null> {
  const goal = await getGoal(id);
  if (!goal) return null;

  const newSaved = goal.savedAmountUgx + amountUgx;
  const milestones = goal.milestones.map((m) => {
    if (!m.completed && newSaved >= (m.targetAmountUgx || 0)) {
      return { ...m, completed: true, completedAt: new Date().toISOString() };
    }
    return m;
  });

  const status = newSaved >= goal.targetAmountUgx ? 'completed' : goal.status;

  return updateGoal(id, {
    savedAmountUgx: newSaved,
    milestones,
    status: status as 'active' | 'completed' | 'cancelled',
  });
}

function goalRow(data: any): Goal {
  return {
    id: data.id,
    title: data.title,
    description: data.description || '',
    targetAmountUgx: Number(data.target_amount_ugx),
    savedAmountUgx: Number(data.saved_amount_ugx),
    targetDate: data.target_date || '2026-12-31',
    category: data.category || 'other',
    status: data.status || 'active',
    createdAt: data.created_at,
    milestones: data.milestones || [],
  };
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function getTransactions(options?: {
  type?: string;
  page?: number;
  limit?: number;
  goalId?: string;
}): Promise<{ transactions: Transaction[]; total: number }> {
  const type = options?.type;
  const page = options?.page || 1;
  const limit = Math.min(options?.limit || 50, 100);
  const offset = (page - 1) * limit;

  let query = db()
    .from('transactions')
    .select('*', { count: 'exact' });
  if (currentUserId()) query = query.eq('user_id', currentUserId());

  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  if (options?.goalId) {
    query = query.eq('goal_id', options.goalId);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  checkError(error, 'getTransactions');
  return {
    transactions: (data || []).map(txRow),
    total: count || 0,
  };
}

export async function getTransactionByKotaniRef(referenceId: string): Promise<Transaction | null> {
  let query = db()
    .from('transactions')
    .select('*')
    .eq('kotani_reference_id', referenceId)
    .limit(1);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { data, error } = await query.single();

  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'getTransactionByKotaniRef');
  return data ? txRow(data) : null;
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  let query = db()
    .from('transactions')
    .select('*')
    .eq('id', id);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { data, error } = await query.single();

  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'getTransaction');
  return data ? txRow(data) : null;
}

export async function createTransaction(
  input: Omit<Transaction, 'id' | 'createdAt'> & { goalId?: string }
): Promise<Transaction> {
  const record = {
      user_id: requireUserId(),
      type: input.type,
      amount_usdc: input.amountUsdc,
      amount_ugx: input.amountUgx || null,
      rate: input.rate || null,
      recipient_name: input.recipientName || '',
      recipient_phone: input.recipientPhone || '',
      recipient_network: input.recipientNetwork || '',
      status: input.status || 'pending',
      purpose: input.purpose || '',
      stellar_tx_hash: input.stellarTxHash || '',
      stellar_operation_id: input.stellarOperationId || '',
      kotani_reference_id: input.kotaniReferenceId || '',
      kotani_status: input.kotaniStatus || '',
      goal_id: input.goalId || null,
      recipient_commitment: input.recipientCommitment || null,
      safety_audit_hash: input.safetyAuditHash || null,
      safety_policy_version: input.safetyPolicyVersion || null,
      safety_flags: input.safetyFlags || [],
    };
  let { data, error } = await db()
    .from('transactions')
    .insert(record)
    .select()
    .single();

  // Keep existing deployments operational until the additive verification
  // migration is applied. The transfer still succeeds, but cannot claim an
  // anchored privacy proof until those columns exist.
  if (error && /recipient_commitment|safety_audit_hash|safety_policy_version|safety_flags/i.test(error.message || '')) {
    console.warn('  ⚠️ Privacy verification migration is not installed; saving transaction without verification metadata.');
    const {
      recipient_commitment: _recipientCommitment,
      safety_audit_hash: _safetyAuditHash,
      safety_policy_version: _safetyPolicyVersion,
      safety_flags: _safetyFlags,
      ...legacyRecord
    } = record;
    ({ data, error } = await db()
      .from('transactions')
      .insert(legacyRecord)
      .select()
      .single());
  }

  checkError(error, 'createTransaction');
  if (!data) throw new Error('Failed to create transaction');
  return txRow(data);
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<Transaction | null> {
  const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.kotaniStatus !== undefined) dbUpdates.kotani_status = updates.kotaniStatus;
  if (updates.stellarTxHash !== undefined) dbUpdates.stellar_tx_hash = updates.stellarTxHash;

  let query = db()
    .from('transactions')
    .update(dbUpdates)
    .eq('id', id);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { data, error } = await query.select().single();

  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'updateTransaction');
  return data ? txRow(data) : null;
}

export async function getTransactionStats(): Promise<{
  totalSent: number;
  totalReceived: number;
  thisMonth: number;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let sentQuery = db()
    .from('transactions')
    .select('amount_usdc')
    .eq('type', 'sent')
    .eq('status', 'completed');
  if (currentUserId()) sentQuery = sentQuery.eq('user_id', currentUserId());
  const { data: sentData, error: sentErr } = await sentQuery;
  checkError(sentErr, 'getTransactionStats (sent)');

  let receivedQuery = db()
    .from('transactions')
    .select('amount_usdc')
    .eq('type', 'received')
    .eq('status', 'completed');
  if (currentUserId()) receivedQuery = receivedQuery.eq('user_id', currentUserId());
  const { data: receivedData, error: recErr } = await receivedQuery;
  checkError(recErr, 'getTransactionStats (received)');

  let monthQuery = db()
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfMonth);
  if (currentUserId()) monthQuery = monthQuery.eq('user_id', currentUserId());
  const { count, error: countErr } = await monthQuery;
  checkError(countErr, 'getTransactionStats (month)');

  return {
    totalSent: (sentData || []).reduce((s, r) => s + Number(r.amount_usdc), 0),
    totalReceived: (receivedData || []).reduce((s, r) => s + Number(r.amount_usdc), 0),
    thisMonth: count || 0,
  };
}

export async function getPendingTransactions(): Promise<Transaction[]> {
  const { data, error } = await db()
    .from('transactions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);
  checkError(error, 'getPendingTransactions');
  return (data || []).map(txRow);
}

export async function countPendingTransactions(): Promise<number> {
  const { count, error } = await db()
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  checkError(error, 'countPendingTransactions');
  return count || 0;
}

function txRow(data: any): Transaction {
  return {
    id: data.id,
    type: data.type,
    amountUsdc: Number(data.amount_usdc),
    amountUgx: data.amount_ugx ? Number(data.amount_ugx) : undefined,
    rate: data.rate ? Number(data.rate) : undefined,
    recipientName: data.recipient_name || '',
    recipientPhone: data.recipient_phone || '',
    recipientNetwork: data.recipient_network || undefined,
    status: data.status,
    purpose: data.purpose || '',
    stellarTxHash: data.stellar_tx_hash || undefined,
    stellarOperationId: data.stellar_operation_id || undefined,
    kotaniReferenceId: data.kotani_reference_id || undefined,
    kotaniStatus: data.kotani_status || undefined,
    goalId: data.goal_id || undefined,
    recipientCommitment: data.recipient_commitment || undefined,
    safetyAuditHash: data.safety_audit_hash || undefined,
    safetyPolicyVersion: data.safety_policy_version || undefined,
    safetyFlags: Array.isArray(data.safety_flags) ? data.safety_flags : [],
    createdAt: data.created_at,
  };
}

// ---------------------------------------------------------------------------
// Chat Sessions
// ---------------------------------------------------------------------------

export async function getChatSessions(): Promise<ChatSession[]> {
  let query = db()
    .from('chat_sessions')
    .select('*');
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { data, error } = await query.order('last_message_at', { ascending: false });

  checkError(error, 'getChatSessions');
  return (data || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    lastMessageAt: r.last_message_at || r.created_at,
  }));
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  let query = db()
    .from('chat_sessions')
    .select('*')
    .eq('id', id);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { data, error } = await query.single();

  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'getChatSession');
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    createdAt: data.created_at,
    lastMessageAt: data.last_message_at || data.created_at,
  };
}

export async function createChatSession(title: string): Promise<ChatSession> {
  const { data, error } = await db()
    .from('chat_sessions')
    .insert({ user_id: requireUserId(), title, last_message_at: new Date().toISOString() })
    .select()
    .single();

  checkError(error, 'createChatSession');
  if (!data) throw new Error('Failed to create session');
  return {
    id: data.id,
    title: data.title,
    createdAt: data.created_at,
    lastMessageAt: data.last_message_at,
  };
}

export async function deleteChatSession(id: string): Promise<void> {
  if (!(await getChatSession(id))) return;
  const { error: msgErr } = await db()
    .from('chat_messages')
    .delete()
    .eq('session_id', id);
  checkError(msgErr, 'deleteChatSession (messages)');

  let query = db()
    .from('chat_sessions')
    .delete()
    .eq('id', id);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { error } = await query;
  checkError(error, 'deleteChatSession');
}

export async function updateChatSessionTitle(id: string, title: string): Promise<void> {
  let query = db()
    .from('chat_sessions')
    .update({ title, last_message_at: new Date().toISOString() })
    .eq('id', id);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { error } = await query;
  checkError(error, 'updateChatSessionTitle');
}

export async function touchChatSession(id: string): Promise<void> {
  let query = db()
    .from('chat_sessions')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', id);
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  const { error } = await query;
  checkError(error, 'touchChatSession');
}

// ---------------------------------------------------------------------------
// Chat Messages
// ---------------------------------------------------------------------------

export async function getChatMessages(sessionId?: string): Promise<ChatMessage[]> {
  let query = db()
    .from('chat_messages')
    .select('*');
  if (currentUserId()) query = query.eq('user_id', currentUserId());

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: true });

  checkError(error, 'getChatMessages');
  return (data || []).map((r: any) => ({
    id: r.id,
    role: r.role as 'user' | 'assistant' | 'system',
    content: r.content,
    timestamp: r.created_at,
    sessionId: r.session_id || undefined,
  }));
}

export async function addChatMessage(msg: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sessionId?: string;
}): Promise<void> {
  const insert: any = { user_id: requireUserId(), role: msg.role, content: msg.content };
  if (msg.sessionId) insert.session_id = msg.sessionId;
  const { error } = await db().from('chat_messages').insert(insert);
  checkError(error, 'addChatMessage');
}

export async function clearChatMessages(sessionId?: string): Promise<void> {
  let query = db().from('chat_messages').delete();
  if (currentUserId()) query = query.eq('user_id', currentUserId());
  if (sessionId) {
    query = query.eq('session_id', sessionId);
  } else {
    query = query.neq('id', '00000000-0000-0000-0000-000000000000');
  }
  const { error } = await query;
  checkError(error, 'clearChatMessages');

  if (!sessionId) {
    const { error: seedErr } = await db().from('chat_messages').insert({
      user_id: requireUserId(),
      role: 'assistant',
      content: "Hi! I'm **HomeWard**, your AI financial companion. I can help you send money to Uganda, track your savings goals, and more. What would you like to do today?",
    });
    checkError(seedErr, 'clearChatMessages (seed)');
  }
}

// ---------------------------------------------------------------------------
// In-app notifications (always scoped to the authenticated owner)
// ---------------------------------------------------------------------------

export async function createNotification(input: { title: string; body: string; category: AppNotification['category'] }): Promise<void> {
  const { error } = await db().from('notifications').insert({ user_id: requireUserId(), ...input });
  checkError(error, 'createNotification');
}

export async function getNotifications(): Promise<AppNotification[]> {
  const userId = requireUserId();
  const { data, error } = await db().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
  checkError(error, 'getNotifications');
  return (data || []).map((row: any) => ({ id: row.id, title: row.title, body: row.body, category: row.category, readAt: row.read_at || undefined, createdAt: row.created_at }));
}

export async function markNotificationsRead(): Promise<void> {
  const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', requireUserId()).is('read_at', null);
  checkError(error, 'markNotificationsRead');
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', requireUserId()).is('read_at', null);
  checkError(error, 'markNotificationRead');
}

// ---------------------------------------------------------------------------
// Saved recipients (a private address book, never a payment authorisation)
// ---------------------------------------------------------------------------

function recipientRow(row: any): Recipient {
  return { id: row.id, fullName: row.full_name, phone: row.phone, network: row.network, relationship: row.relationship || 'Family', nickname: row.nickname || undefined, monthlyPlanUsdc: row.monthly_plan_usdc ? Number(row.monthly_plan_usdc) : undefined, createdAt: row.created_at };
}

export async function getRecipients(): Promise<Recipient[]> {
  const { data, error } = await db().from('recipients').select('*').eq('user_id', requireUserId()).order('created_at', { ascending: false });
  checkError(error, 'getRecipients');
  return (data || []).map(recipientRow);
}

export async function createRecipient(input: Omit<Recipient, 'id' | 'createdAt'>): Promise<Recipient> {
  const { data, error } = await db().from('recipients').insert({ user_id: requireUserId(), full_name: input.fullName, phone: input.phone, network: input.network, relationship: input.relationship, nickname: input.nickname || null, monthly_plan_usdc: input.monthlyPlanUsdc || null }).select().single();
  checkError(error, 'createRecipient');
  return recipientRow(data);
}

export async function updateRecipient(id: string, input: Omit<Recipient, 'id' | 'createdAt'>): Promise<Recipient | null> {
  const { data, error } = await db().from('recipients').update({ full_name: input.fullName, phone: input.phone, network: input.network, relationship: input.relationship, nickname: input.nickname || null, monthly_plan_usdc: input.monthlyPlanUsdc || null, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', requireUserId()).select().single();
  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'updateRecipient');
  return recipientRow(data);
}

export async function deleteRecipient(id: string): Promise<void> {
  const { error } = await db().from('recipients').delete().eq('id', id).eq('user_id', requireUserId());
  checkError(error, 'deleteRecipient');
}

export async function getRecipientTransferInsights(phone: string): Promise<{ completedCount: number; usualAmountUsdc: number; sentThisMonthUsdc: number; lastNetwork?: string }> {
  const userId = requireUserId();
  const { data, error } = await db().from('transactions').select('amount_usdc, recipient_network, created_at').eq('user_id', userId).eq('type', 'sent').eq('status', 'completed').eq('recipient_phone', phone).order('created_at', { ascending: false }).limit(12);
  checkError(error, 'getRecipientTransferInsights');
  const records = data || [];
  const amounts = records.map((row: any) => Number(row.amount_usdc)).sort((a: number, b: number) => a - b);
  const usualAmountUsdc = amounts.length ? amounts[Math.floor(amounts.length / 2)] : 0;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const sentThisMonthUsdc = records.filter((row: any) => new Date(row.created_at).getTime() >= monthStart).reduce((total: number, row: any) => total + Number(row.amount_usdc), 0);
  return { completedCount: records.length, usualAmountUsdc, sentThisMonthUsdc, lastNetwork: records[0]?.recipient_network || undefined };
}

export async function getRecipientPassport(id: string): Promise<RecipientPassport | null> {
  const userId = requireUserId();
  const { data, error } = await db().from('recipients').select('*').eq('id', id).eq('user_id', userId).single();
  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'getRecipientPassport');
  const recipient = recipientRow(data);
  const insights = await getRecipientTransferInsights(recipient.phone);
  const { data: latest, error: latestError } = await db().from('transactions').select('*').eq('user_id', userId).eq('type', 'sent').eq('status', 'completed').eq('recipient_phone', recipient.phone).order('created_at', { ascending: false }).limit(1).maybeSingle();
  checkError(latestError, 'getRecipientPassport latest payment');
  return { ...recipient, transferCount: insights.completedCount, usualAmountUsdc: insights.usualAmountUsdc, lastSuccessfulNetwork: insights.lastNetwork as 'MTN' | 'AIRTEL' | undefined, lastSuccessfulPayment: latest ? txRow(latest) : undefined };
}

function circleRow(row: any): Omit<Circle, 'recipient' | 'goal' | 'contributionCount' | 'totalContributedUgx' | 'lastPayment'> {
  return { id: row.id, name: row.name, description: row.description || undefined, recipientId: row.recipient_id || undefined, goalId: row.goal_id || undefined, recurringAmountUsdc: Number(row.recurring_amount_usdc || 0), purpose: row.purpose || 'Family support', status: row.status, createdAt: row.created_at };
}

export async function getCircles(): Promise<Circle[]> {
  const userId = requireUserId();
  const { data, error } = await db().from('circles').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  checkError(error, 'getCircles');
  const recipients = await getRecipients();
  const goals = await getGoals();
  return Promise.all((data || []).map(async (row: any) => {
    const circle = circleRow(row);
    let query = db().from('transactions').select('*').eq('user_id', userId).eq('type', 'sent').eq('status', 'completed');
    if (circle.goalId) query = query.eq('goal_id', circle.goalId); else if (circle.recipientId) {
      const recipient = recipients.find((item) => item.id === circle.recipientId);
      if (recipient) query = query.eq('recipient_phone', recipient.phone);
    }
    const { data: payments, error: paymentError } = await query.order('created_at', { ascending: false }).limit(100);
    checkError(paymentError, 'getCircles payments');
    const history = (payments || []).map(txRow);
    return { ...circle, recipient: recipients.find((item) => item.id === circle.recipientId), goal: goals.find((item) => item.id === circle.goalId), contributionCount: history.length, totalContributedUgx: history.reduce((sum, item) => sum + (item.amountUgx || 0), 0), lastPayment: history[0] };
  }));
}

export async function createCircle(input: Pick<Circle, 'name' | 'description' | 'recipientId' | 'goalId' | 'recurringAmountUsdc' | 'purpose'>): Promise<Circle> {
  const { data, error } = await db().from('circles').insert({ user_id: requireUserId(), name: input.name, description: input.description || null, recipient_id: input.recipientId || null, goal_id: input.goalId || null, recurring_amount_usdc: input.recurringAmountUsdc, purpose: input.purpose || 'Family support', status: 'active' }).select().single();
  checkError(error, 'createCircle');
  return { ...circleRow(data), contributionCount: 0, totalContributedUgx: 0 };
}

export async function updateCircle(id: string, input: Partial<Pick<Circle, 'name' | 'description' | 'recipientId' | 'goalId' | 'recurringAmountUsdc' | 'purpose' | 'status'>>): Promise<Circle | null> {
  const { data, error } = await db().from('circles').update({ name: input.name, description: input.description, recipient_id: input.recipientId, goal_id: input.goalId, recurring_amount_usdc: input.recurringAmountUsdc, purpose: input.purpose, status: input.status }).eq('id', id).eq('user_id', requireUserId()).select().single();
  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'updateCircle');
  return { ...circleRow(data), contributionCount: 0, totalContributedUgx: 0 };
}

export async function deleteCircle(id: string): Promise<void> {
  const { error } = await db().from('circles').delete().eq('id', id).eq('user_id', requireUserId());
  checkError(error, 'deleteCircle');
}


// ---------------------------------------------------------------------------
// Exchange Rates
// ---------------------------------------------------------------------------

export async function getLatestRate(): Promise<ExchangeRate | null> {
  const { data, error } = await db()
    .from('exchange_rates')
    .select('*')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'getLatestRate');
  if (!data) return null;

  return {
    usdcToUgx: Number(data.usdc_to_ugx),
    usdToUgx: Number(data.usd_to_ugx),
    lastUpdated: data.fetched_at,
    change24h: Number(data.change_24h),
  };
}

export async function saveRate(rate: ExchangeRate): Promise<void> {
  const { error } = await db().from('exchange_rates').insert({
    usdc_to_ugx: rate.usdcToUgx,
    usd_to_ugx: rate.usdToUgx,
    change_24h: rate.change24h || 0,
    fetched_at: rate.lastUpdated || new Date().toISOString(),
  });
  checkError(error, 'saveRate');
}

// ---------------------------------------------------------------------------
// User Profiles
// ---------------------------------------------------------------------------

export async function getProfileByPhone(phone: string): Promise<UserProfile | null> {
  const { data, error } = await db()
    .from('profiles')
    .select('*')
    .eq('phone', phone)
    .limit(1)
    .single();

  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'getProfileByPhone');
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    pinHash: data.pin_hash,
    createdAt: data.created_at,
  };
}

export async function getProfile(id: string): Promise<UserProfile | null> {
  const { data, error } = await db()
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'getProfile');
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    pinHash: data.pin_hash,
    createdAt: data.created_at,
  };
}

export async function createProfile(input: {
  name: string;
  phone: string;
  pinHash: string;
}): Promise<UserProfile> {
  const { data, error } = await db()
    .from('profiles')
    .insert({
      name: input.name,
      phone: input.phone,
      pin_hash: input.pinHash,
    })
    .select()
    .single();

  checkError(error, 'createProfile');
  if (!data) throw new Error('Failed to create profile');
  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    pinHash: data.pin_hash,
    createdAt: data.created_at,
  };
}

export async function updateCurrentProfile(input: { name: string }): Promise<UserProfile | null> {
  const { data, error } = await db().from('profiles').update({ name: input.name, updated_at: new Date().toISOString() }).eq('id', requireUserId()).select().single();
  if (error && error.code === 'PGRST116') return null;
  checkError(error, 'updateCurrentProfile');
  return data ? { id: data.id, name: data.name, phone: data.phone, pinHash: data.pin_hash, createdAt: data.created_at } : null;
}
