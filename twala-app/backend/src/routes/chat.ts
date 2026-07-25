import { Router } from 'express';
import * as ai from '../services/ai.js';
import * as db from '../services/database.js';

const router = Router();

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

router.get('/sessions', async (_req, res) => {
  const sessions = await db.getChatSessions();
  res.json({ success: true, data: sessions });
});

router.post('/sessions', async (req, res) => {
  const { title } = req.body;
  const session = await db.createChatSession(title || 'New Chat');
  // Seed welcome message
  await db.addChatMessage({
    role: 'assistant',
    content: "Hi! I'm **HomeWard**, your AI financial companion. I can help you send money to Uganda, track your savings goals, and more. What would you like to do today?",
    sessionId: session.id,
  });
  res.json({ success: true, data: session });
});

router.get('/sessions/:id', async (req, res) => {
  const session = await db.getChatSession(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  const messages = await db.getChatMessages(req.params.id);
  res.json({ success: true, data: { session, messages } });
});

router.delete('/sessions/:id', async (req, res) => {
  const session = await db.getChatSession(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  await db.deleteChatSession(req.params.id);
  res.json({ success: true, message: 'Chat deleted' });
});

// ---------------------------------------------------------------------------
// Send message to a session (the core AI flow)
// ---------------------------------------------------------------------------

router.post('/sessions/:id/send', async (req, res) => {
  const { message, userName, userPhone } = req.body;
  const sessionId = req.params.id;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message required' });
  }

  const session = await db.getChatSession(sessionId);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  // Save user message
  await db.addChatMessage({ role: 'user', content: message.trim(), sessionId });

  // Auto-title from first user message (only if still "New Chat")
  const msgs = await db.getChatMessages(sessionId);
  const userMsgCount = msgs.filter((m) => m.role === 'user').length;
  if (userMsgCount === 1 && session.title === 'New Chat') {
    const autoTitle = message.trim().substring(0, 60) + (message.trim().length > 60 ? '...' : '');
    await db.updateChatSessionTitle(sessionId, autoTitle);
  } else {
    await db.touchChatSession(sessionId);
  }

  try {
    const { messages, navigate } = await ai.chat(message.trim(), sessionId, userName, userPhone);
    res.json({ success: true, data: { messages, navigate } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// ---------------------------------------------------------------------------
// Existing: full history, suggestions, delete-all (backward compat)
// ---------------------------------------------------------------------------

router.get('/', async (_req, res) => {
  const history = await db.getChatMessages();
  res.json({ success: true, data: history });
});

router.get('/suggestions', async (_req, res) => {
  const suggestions: string[] = [];
  const wallet = await db.getWallet();
  const goals = await db.getGoals();

  if (wallet && wallet.balanceUsdc > 0) {
    suggestions.push('What is my balance?');
    suggestions.push('Send money to Uganda');
  } else {
    suggestions.push('Create a wallet');
  }
  if (goals.length > 0) {
    suggestions.push(`How is "${goals[0].title.substring(0, 20)}" doing?`);
    suggestions.push('Add to savings goal');
  } else {
    suggestions.push('Help me set a savings goal');
  }
  suggestions.push('What is the exchange rate?');
  suggestions.push('Show recent transactions');
  suggestions.push('What can you do?');

  res.json({ success: true, data: suggestions });
});

router.delete('/', async (_req, res) => {
  await db.clearChatMessages();
  const history = await db.getChatMessages();
  res.json({ success: true, data: history });
});

export default router;
