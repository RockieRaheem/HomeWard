import { Router } from 'express';
import * as db from '../services/database.js';

const router = Router();
function valid(body: any) {
  if (!body.name?.trim()) return 'Circle name is required';
  if (!Number.isFinite(Number(body.recurringAmountUsdc)) || Number(body.recurringAmountUsdc) <= 0) return 'Set a recurring amount greater than zero';
  if (!body.recipientId && !body.goalId) return 'Choose a trusted recipient or a goal';
  return null;
}
router.get('/', async (_req, res) => { try { res.json({ success: true, data: await db.getCircles() }); } catch (err) { res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) }); } });
router.post('/', async (req, res) => { const error = valid(req.body); if (error) return res.status(400).json({ success: false, message: error }); try { const circle = await db.createCircle({ name: req.body.name.trim(), description: req.body.description?.trim(), recipientId: req.body.recipientId, goalId: req.body.goalId, recurringAmountUsdc: Number(req.body.recurringAmountUsdc), purpose: req.body.purpose?.trim() || 'Family support' }); res.status(201).json({ success: true, data: circle }); } catch (err) { res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) }); } });
router.put('/:id', async (req, res) => { try { const circle = await db.updateCircle(req.params.id, req.body); if (!circle) return res.status(404).json({ success: false, message: 'Circle not found' }); res.json({ success: true, data: circle }); } catch (err) { res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) }); } });
router.delete('/:id', async (req, res) => { try { await db.deleteCircle(req.params.id); res.json({ success: true }); } catch (err) { res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) }); } });
export default router;
