import { Router } from 'express';
import * as db from '../services/database.js';

const router = Router();

router.get('/', async (_req, res) => {
  const goals = await db.getGoals();
  res.json({ success: true, data: goals });
});

router.get('/:id', async (req, res) => {
  const goal = await db.getGoal(req.params.id);
  if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
  res.json({ success: true, data: goal });
});

router.post('/', async (req, res) => {
  const { title, description, targetAmountUgx, targetDate, category, milestones } = req.body;
  if (!title || !targetAmountUgx) {
    return res.status(400).json({ success: false, message: 'title and targetAmountUgx required' });
  }

  const goal = await db.createGoal({
    title,
    description: description || '',
    targetAmountUgx,
    targetDate: targetDate || undefined,
    category: category || 'other',
    milestones: milestones || [],
  });

  res.json({ success: true, data: goal });
});

router.put('/:id', async (req, res) => {
  const { title, description, targetAmountUgx, targetDate, category, milestones, status } = req.body;

  const goal = await db.getGoal(req.params.id);
  if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (targetAmountUgx !== undefined) updates.targetAmountUgx = targetAmountUgx;
  if (targetDate !== undefined) updates.targetDate = targetDate;
  if (category !== undefined) updates.category = category;
  if (milestones !== undefined) updates.milestones = milestones;
  if (status !== undefined) updates.status = status;

  const updated = await db.updateGoal(req.params.id, updates as any);
  res.json({ success: true, data: updated });
});

router.delete('/:id', async (req, res) => {
  const goal = await db.getGoal(req.params.id);
  if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

  await db.deleteGoal(req.params.id);
  res.json({ success: true, message: 'Goal deleted' });
});

router.post('/:id/contribute', async (req, res) => {
  const { amountUgx } = req.body;
  if (!amountUgx || amountUgx <= 0) {
    return res.status(400).json({ success: false, message: 'Valid amountUgx required' });
  }

  const goal = await db.contributeToGoal(req.params.id, amountUgx);
  if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

  // Record the contribution as a transaction
  await db.createTransaction({
    type: 'received',
    amountUsdc: amountUgx / 3750,
    amountUgx,
    rate: 3750,
    recipientName: `Contribution to ${goal.title}`,
    purpose: 'Goal Contribution',
    status: 'completed',
    goalId: goal.id,
  });
  await db.createNotification({
    category: 'goal',
    title: 'Goal contribution recorded',
    body: `UGX ${Number(amountUgx).toLocaleString()} was added to ${goal.title}.`,
  });

  res.json({ success: true, data: goal });
});

export default router;
