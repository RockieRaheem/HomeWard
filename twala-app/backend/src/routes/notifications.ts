import { Router } from 'express';
import * as db from '../services/database.js';

const router = Router();

router.get('/', async (_req, res) => {
  try { res.json({ success: true, data: await db.getNotifications() }); }
  catch (err) { res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) }); }
});

router.post('/read-all', async (_req, res) => {
  try { await db.markNotificationsRead(); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) }); }
});

router.post('/:id/read', async (req, res) => {
  try { await db.markNotificationRead(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) }); }
});

export default router;
