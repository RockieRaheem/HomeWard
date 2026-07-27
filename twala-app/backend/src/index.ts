import 'dotenv/config';
import os from 'os';
import express from 'express';
import cors from 'cors';
import config from './config.js';
import walletRouter from './routes/wallet.js';
import transferRouter from './routes/transfer.js';
import goalsRouter from './routes/goals.js';
import historyRouter from './routes/history.js';
import chatRouter from './routes/chat.js';
import ratesRouter from './routes/rates.js';
import kotaniRouter from './routes/kotani.js';
import authRouter from './routes/auth.js';
import transakRouter from './routes/transak.js';
import moneygramRouter from './routes/moneygram.js';
import notificationsRouter from './routes/notifications.js';
import recipientsRouter from './routes/recipients.js';
import circlesRouter from './routes/circles.js';
import * as stellar from './services/stellar.js';
import * as db from './services/database.js';
import * as kotani from './services/kotani.js';
import { sendTransferNotification } from './services/sms.js';
import { notifyChange, getChangeVersion } from './services/events.js';
import { requireAuth } from './middleware/auth.js';

function getLanIp(): string {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const app = express();

app.use(cors());
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', async (_req, res) => {
  const wallet = await db.getWallet().catch(() => null);
  const goals = await db.getGoals().catch(() => []);
  const { transactions } = await db.getTransactions({ limit: 1 }).catch(() => ({ transactions: [], total: 0 }));

  res.json({
    success: true,
    data: {
      status: 'ok',
      database: 'supabase',
      stellarNetwork: config.stellar.network,
      stellarHorizon: config.stellar.horizonUrl,
      usdcIssuer: config.stellar.usdcIssuer,
      walletExists: !!wallet,
      walletAddress: wallet?.publicKey || null,
      walletFunded: wallet?.isFunded || false,
      goalsCount: goals.length,
      transactionsCount: transactions.length,
      kotaniConfigured: !!config.kotani.apiKey,
      aiConfigured: !!process.env.GROQ_API_KEY || !!process.env.GEMINI_API_KEY,
    },
  });
});

// GET /api/events/version — lightweight poll for detecting changes
app.get('/api/events/version', (_req, res) => {
  res.json({ success: true, data: { version: getChangeVersion() } });
});

app.use('/api/wallet', requireAuth, walletRouter);
app.use('/api/transfer', requireAuth, transferRouter);
app.use('/api/goals', requireAuth, goalsRouter);
app.use('/api/history', requireAuth, historyRouter);
app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/rates', ratesRouter);
app.use('/api/kotani', requireAuth, kotaniRouter);
app.use('/api/auth', authRouter);
app.use('/api/transak', requireAuth, transakRouter);
app.use('/api/moneygram', requireAuth, moneygramRouter);
app.use('/api/notifications', requireAuth, notificationsRouter);
app.use('/api/recipients', requireAuth, recipientsRouter);
app.use('/api/circles', requireAuth, circlesRouter);

// POST /api/sms/test — quick SMS test endpoint (fire-and-forget)
app.post('/api/sms/test', express.json(), async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'phone required' });
  const result = await sendTransferNotification({
    phoneNumber: phone,
    recipientName: 'Test Recipient',
    amountUgx: 50000,
    amountUsdc: 10,
    senderName: 'HomeWard Test',
  });
  res.status(result.success ? 200 : 502).json({ success: result.success, data: result, message: result.message });
});

// POST /api/sms/diagnose — comprehensive AT auth diagnosis
app.post('/api/sms/diagnose', express.json(), async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'phone required' });
  const result = await sendTransferNotification({
    phoneNumber: phone,
    recipientName: 'Diagnostic Recipient',
    amountUgx: 1,
    amountUsdc: 0,
    senderName: 'HomeWard Diagnostics',
  });
  res.status(result.success ? 200 : 502).json({
    success: result.success,
    data: {
      environment: config.africasTalking.useSandbox ? 'sandbox' : 'live',
      configuredUsername: config.africasTalking.useSandbox ? 'sandbox' : config.africasTalking.username,
      result,
    },
    message: result.message,
  });
});

// ---------------------------------------------------------------------------
// Kotani offramp completion listener — auto-completes demo mode transactions
// ---------------------------------------------------------------------------

kotani.onOfframpComplete(async (referenceId, status) => {
  try {
    const tx = await db.getTransactionByKotaniRef(referenceId);
    if (tx && tx.status === 'pending') {
      const newStatus = ['completed', 'SUCCESSFUL', 'REFUNDED'].includes(status) ? 'completed' : 'failed';
      await db.updateTransaction(tx.id, { status: newStatus, kotaniStatus: status });
      notifyChange();
      console.log(`  ✅ Kotani offramp ${referenceId.slice(-8)} → ${status}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Kotani callback error: ${msg}`);
  }
});

// Older Testnet transfers were stored as pending while waiting for a sandbox
// callback. They have no real fiat payout, so reconcile verified demo records
// once when this Testnet backend starts. Production records are never touched.
async function reconcileTestnetTransactions(): Promise<void> {
  if (config.stellar.network !== 'TESTNET') return;
  const pending = await db.getPendingTransactions();
  let reconciled = 0;
  for (const tx of pending) {
    if (tx.stellarTxHash) {
      await db.updateTransaction(tx.id, { status: 'completed', kotaniStatus: 'SIMULATED_COMPLETED' });
      reconciled++;
    }
  }
  if (reconciled > 0) {
    notifyChange();
    console.log(`  ✅ Reconciled ${reconciled} Stellar Testnet demo transaction${reconciled === 1 ? '' : 's'}`);
  }
}

// ---------------------------------------------------------------------------
// Background poller for pending transactions — catches stale demo offramps
// ---------------------------------------------------------------------------

setInterval(async () => {
  try {
    const pending = await db.countPendingTransactions();
    if (pending > 0) {
      const txs = await db.getPendingTransactions();
      for (const tx of txs) {
        if (tx.kotaniReferenceId) {
          try {
            const result = await kotani.getOfframpStatus(tx.kotaniReferenceId);
            if (result.success && result.data) {
              const ks = result.data.status;
              const terminal: Record<string, 'completed' | 'failed'> = { SUCCESSFUL: 'completed', FAILED: 'failed', REFUNDED: 'completed' };
              const newStatus = terminal[ks];
              if (newStatus && tx.status === 'pending') {
                await db.updateTransaction(tx.id, { status: newStatus, kotaniStatus: ks });
                notifyChange();
                console.log(`  ${newStatus === 'completed' ? '✅' : '❌'} Background: offramp ${tx.kotaniReferenceId.slice(-8)} → ${ks}`);
              }
            }
          } catch { /* ignore poll errors */ }
        }
      }
    }
  } catch { /* ignore */ }
}, 10000); // poll every 10s

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

app.listen(config.port, '0.0.0.0', async () => {
  console.log(`\n  🏦 HomeWard Backend running`);
  console.log(`  ─────────────────────`);
  console.log(`  Network : ${config.stellar.network}`);
  console.log(`  Horizon : ${config.stellar.horizonUrl}`);
  console.log(`  Port    : ${config.port}`);
  console.log(`  Kotani  : ${config.kotani.apiKey ? `LIVE (${config.kotani.useSandbox ? 'sandbox' : 'production'})` : 'Demo mode — set KOTANI_API_KEY'}`);
  console.log(`  SMS     : ${config.africasTalking.apiKey ? `LIVE (${config.africasTalking.username})` : 'Demo mode — set AT_API_KEY'}`);
  const lanIp = getLanIp();
  console.log(`  Address : http://localhost:${config.port}`);
  console.log(`  LAN     : http://${lanIp}:${config.port}`);
  console.log(`  API     : http://localhost:${config.port}/api/health\n`);

  // Step 1: Initialize test USDC issuer
  await stellar.initializeTestUsdc();
  await reconcileTestnetTransactions();

  // Step 2: Check for existing wallet in DB
  let existing = await db.getWallet().catch(() => null);

  if (existing) {
    console.log(`  🔄 Restoring wallet from database...`);
    const balance = await stellar.getBalance(existing.publicKey);
    console.log(`  ✅ Wallet  : ${existing.publicKey} ${existing.isFunded ? '(funded)' : '(unfunded)'}`);

    // Ensure trustline and mint if freshly restored
    if (existing.isFunded) {
      try {
        await stellar.ensureTrustline(existing.secretKey);
      } catch (tlErr) {
        const msg = tlErr instanceof Error ? tlErr.message : String(tlErr);
        console.log(`  ⚠️  Trustline: ${msg}`);
      }
      if (balance.usdc === 0) {
        await stellar.mintTestUsdc(existing.secretKey, config.testUsdc.initialMintAmount);
      }
      const fresh = await stellar.getBalance(existing.publicKey);
      await db.updateWalletBalance(existing.publicKey, fresh.usdc, fresh.xlm);
      console.log(`  💰 Balance : $${fresh.usdc.toFixed(2)} USDC · ${fresh.xlm.toFixed(2)} XLM`);
    }
  } else {
    console.log(`  🆕 Creating new wallet...`);
    try {
      const wallet = await stellar.createWallet();
      await db.saveWallet(wallet);
      console.log(`  ✅ Wallet  : ${wallet.publicKey} ${wallet.isFunded ? '(funded via Friendbot)' : '(unfunded)'}`);
      console.log(`  🔐 Wallet secret stored in the configured database (not printed to logs)`);

      if (wallet.isFunded) {
        try {
          await stellar.ensureTrustline(wallet.secretKey);
          console.log(`  ✅ Trustline: USDC trustline established`);
        } catch (tlErr) {
          const msg = tlErr instanceof Error ? tlErr.message : String(tlErr);
          console.log(`  ⚠️  Trustline: ${msg}`);
        }

        await stellar.mintTestUsdc(wallet.secretKey, config.testUsdc.initialMintAmount);

        const balance = await stellar.getBalance(wallet.publicKey);
        await db.updateWalletBalance(wallet.publicKey, balance.usdc, balance.xlm);
        console.log(`  💰 Balance : $${balance.usdc.toFixed(2)} USDC · ${balance.xlm.toFixed(2)} XLM`);
        if (balance.usdc > 0) {
          console.log(`  🎉 Wallet is ready for test transactions!`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠️  Wallet  : ${msg}`);
    }
  }
});
