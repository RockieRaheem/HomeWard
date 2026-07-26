import { Router } from 'express';
import config from '../config.js';

const router = Router();

function isConfigured() {
  return Boolean(config.moneygram.cashInUrl && config.moneygram.walletDomain);
}

// GET /api/moneygram/status — safe configuration state for the mobile app.
router.get('/status', (_req, res) => {
  res.json({
    success: true,
    data: {
      configured: isConfigured(),
      environment: config.moneygram.useSandbox ? 'TESTNET' : 'PRODUCTION',
      walletDomain: config.moneygram.walletDomain || null,
      fundingMethod: 'CASH_AT_MONEYGRAM_LOCATION',
      asset: 'USDC on Stellar',
      requiresPartnerApproval: true,
    },
  });
});

// POST /api/moneygram/cash-in — opens the MoneyGram-hosted KYC/cash-in flow.
// The URL is deliberately partner-provided: it must not be fabricated or used
// until MoneyGram has allowlisted HomeWard and approved the UAE programme.
router.post('/cash-in', (req, res) => {
  const amountAed = Number(req.body?.amountAed);
  if (!Number.isFinite(amountAed) || amountAed <= 0) {
    return res.status(400).json({ success: false, message: 'A valid AED cash-in amount is required.' });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'MoneyGram cash-in is awaiting HomeWard partner approval. Use the Stellar Testnet proof for the demo.',
    });
  }

  try {
    const url = new URL(config.moneygram.cashInUrl);
    if (url.protocol !== 'https:') throw new Error('Cash-in URL must use HTTPS');
    return res.json({
      success: true,
      data: {
        cashInUrl: url.toString(),
        environment: config.moneygram.useSandbox ? 'TESTNET' : 'PRODUCTION',
        amountAed,
        message: 'Continue in MoneyGram to complete identity checks, choose an eligible location, and pay AED cash.',
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'MoneyGram cash-in configuration is invalid.' });
  }
});

export default router;
