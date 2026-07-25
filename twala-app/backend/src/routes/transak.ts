import { Router } from 'express';
import * as db from '../services/database.js';
import * as transak from '../services/transak.js';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({ success: true, data: transak.getTransakStatus() });
});

router.post('/checkout', async (req, res) => {
  try {
    const fiatAmount = Number(req.body.fiatAmount);
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : undefined;
    const wallet = await db.getWallet();
    if (!wallet) return res.status(400).json({ success: false, message: 'No wallet found. Create a wallet first.' });

    const forwarded = req.headers['x-forwarded-for'];
    const userIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() || req.ip || req.socket.remoteAddress || '';
    const checkout = await transak.createCheckout({ fiatAmount, walletAddress: wallet.publicKey, email, userIp });
    res.json({ success: true, data: { ...checkout, walletAddress: wallet.publicKey, ...transak.getTransakStatus() } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ success: false, message });
  }
});

export default router;
