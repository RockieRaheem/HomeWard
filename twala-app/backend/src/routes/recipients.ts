import { Router } from 'express';
import * as db from '../services/database.js';

const router = Router();
const validNetwork = (network: unknown) => network === 'MTN' || network === 'AIRTEL';
function validate(body: any): string | null {
  if (!body.fullName?.trim()) return 'Full name is required';
  if (!/^\+[1-9]\d{7,14}$/.test(body.phone?.trim() || '')) return 'Use an international phone number, for example +256712345678';
  if (!validNetwork(body.network)) return 'Choose MTN or Airtel';
  return null;
}
function input(body: any) { return { fullName: body.fullName.trim(), phone: body.phone.trim(), network: body.network, relationship: body.relationship?.trim() || 'Family', nickname: body.nickname?.trim() || undefined } as const; }

router.get('/', async (_req, res) => { try { res.json({ success: true, data: await db.getRecipients() }); } catch (err) { res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) }); } });
router.post('/', async (req, res) => { const error = validate(req.body); if (error) return res.status(400).json({ success: false, message: error }); try { res.status(201).json({ success: true, data: await db.createRecipient(input(req.body)) }); } catch (err: any) { const duplicate = err?.code === '23505' || String(err?.message || '').includes('duplicate key'); res.status(duplicate ? 409 : 500).json({ success: false, message: duplicate ? 'This phone number is already saved. Select it to update its details.' : (err instanceof Error ? err.message : String(err)) }); } });
router.put('/:id', async (req, res) => { const error = validate(req.body); if (error) return res.status(400).json({ success: false, message: error }); try { const recipient = await db.updateRecipient(req.params.id, input(req.body)); if (!recipient) return res.status(404).json({ success: false, message: 'Recipient not found' }); res.json({ success: true, data: recipient }); } catch (err) { res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) }); } });
router.delete('/:id', async (req, res) => { try { await db.deleteRecipient(req.params.id); res.json({ success: true }); } catch (err) { res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) }); } });
export default router;
