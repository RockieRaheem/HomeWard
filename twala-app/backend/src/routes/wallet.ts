import { Router } from 'express';
import * as stellar from '../services/stellar.js';
import * as db from '../services/database.js';
import { notifyChange } from '../services/events.js';
import config from '../config.js';

const router = Router();

async function provisionTestnetWallet() {
  let wallet = await db.getWallet();
  if (!wallet) {
    wallet = await stellar.createWallet();
    await db.saveWallet(wallet);
  }
  await stellar.ensureTrustline(wallet.secretKey);
  let balance = await stellar.getBalance(wallet.publicKey);
  if (config.stellar.network === 'TESTNET' && balance.usdc <= 0) {
    await stellar.mintTestUsdc(wallet.secretKey, config.testUsdc.initialMintAmount);
    balance = await stellar.getBalance(wallet.publicKey);
  }
  await db.updateWalletBalance(wallet.publicKey, balance.usdc, balance.xlm);
  return { wallet, balance };
}

// Ensures each signed-in demo account has its own funded Stellar Testnet wallet.
// Safe to call repeatedly: it only mints when the Testnet USDC balance is zero.
router.post('/provision', async (_req, res) => {
  try {
    const { wallet, balance } = await provisionTestnetWallet();
    res.json({ success: true, data: { publicKey: wallet.publicKey, balanceUsdc: balance.usdc, balanceXlm: balance.xlm, isFunded: wallet.isFunded } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: `Wallet provisioning failed: ${msg}` });
  }
});

router.post('/create', async (_req, res) => {
  try {
    const wallet = await stellar.createWallet();
    await db.saveWallet(wallet);
    await stellar.ensureTrustline(wallet.secretKey);
    if (config.stellar.network === 'TESTNET') {
      await stellar.mintTestUsdc(wallet.secretKey, config.testUsdc.initialMintAmount);
    }
    const freshBalance = await stellar.getBalance(wallet.publicKey);
    res.json({
      success: true,
      data: {
        publicKey: wallet.publicKey,
        balanceUsdc: freshBalance.usdc,
        balanceXlm: freshBalance.xlm,
        isFunded: wallet.isFunded,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: `Wallet creation failed: ${msg}` });
  }
});

router.post('/restore', async (req, res) => {
  try {
    const { secretKey } = req.body;
    if (!secretKey) return res.status(400).json({ success: false, message: 'secretKey required' });

    const wallet = await stellar.restoreWallet(secretKey);
    await db.saveWallet(wallet);
    res.json({
      success: true,
      data: {
        publicKey: wallet.publicKey,
        balanceUsdc: wallet.balanceUsdc,
        balanceXlm: wallet.balanceXlm,
        isFunded: wallet.isFunded,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: `Wallet restoration failed: ${msg}` });
  }
});

router.get('/balance', async (_req, res) => {
  try {
    const wallet = await db.getWallet();
    if (!wallet) {
      return res.json({
        success: true,
        data: { balanceUsdc: 0, balanceXlm: 0, publicKey: null, isFunded: false },
      });
    }
    const balance = await stellar.getBalance(wallet.publicKey);
    await db.updateWalletBalance(wallet.publicKey, balance.usdc, balance.xlm);
    res.json({
      success: true,
      data: {
        balanceUsdc: balance.usdc,
        balanceXlm: balance.xlm,
        publicKey: wallet.publicKey,
        isFunded: wallet.isFunded,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: `Balance check failed: ${msg}` });
  }
});

router.get('/info', async (_req, res) => {
  try {
    const wallet = await db.getWallet();
    if (!wallet) {
      return res.json({ success: true, data: null });
    }
    const balance = await stellar.getBalance(wallet.publicKey);
    await db.updateWalletBalance(wallet.publicKey, balance.usdc, balance.xlm);
    res.json({
      success: true,
      data: {
        publicKey: wallet.publicKey,
        balanceUsdc: balance.usdc,
        balanceXlm: balance.xlm,
        isFunded: wallet.isFunded,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

router.get('/details', async (_req, res) => {
  try {
    const wallet = await db.getWallet();
    if (!wallet) {
      return res.json({ success: true, data: null });
    }
    const info = await stellar.getAccountInfo(wallet.publicKey);
    res.json({ success: true, data: info });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const wallet = await db.getWallet();
    if (!wallet) {
      return res.json({ success: true, data: { payments: [], cursor: '' } });
    }
    const limit = parseInt(req.query.limit as string) || 20;
    const cursor = req.query.cursor as string | undefined;
    const result = await stellar.getStellarPayments(wallet.publicKey, limit, cursor);
    res.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

router.get('/validate/:address', (req, res) => {
  const isValid = stellar.isValidPublicKey(req.params.address);
  res.json({ success: true, data: { address: req.params.address, isValid } });
});

router.post('/generate-keypair', (_req, res) => {
  const keypair = stellar.generateKeypair();
  res.json({
    success: true,
    data: {
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
      message: 'Store this secret key securely. It will not be shown again.',
    },
  });
});

// POST /api/wallet/sync — force balance sync from Stellar to DB
router.post('/sync', async (_req, res) => {
  try {
    const wallet = await db.getWallet();
    if (!wallet) {
      return res.json({ success: true, data: { balanceUsdc: 0, balanceXlm: 0, publicKey: null } });
    }
    const balance = await stellar.getBalance(wallet.publicKey);
    await db.updateWalletBalance(wallet.publicKey, balance.usdc, balance.xlm);
    const pending = await db.countPendingTransactions();
    res.json({
      success: true,
      data: {
        balanceUsdc: balance.usdc,
        balanceXlm: balance.xlm,
        publicKey: wallet.publicKey,
        isFunded: wallet.isFunded,
        pendingTransactions: pending,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

export default router;
