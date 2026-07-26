import { Router } from 'express';
import * as stellar from '../services/stellar.js';
import * as kotani from '../services/kotani.js';
import { getExchangeRate, calculateQuote } from '../services/rates.js';
import * as db from '../services/database.js';
import { sendTransferNotificationAsync } from '../services/sms.js';
import { notifyChange } from '../services/events.js';
import config from '../config.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/transfer/demo-fund — real Stellar Testnet funding for the demo
// ---------------------------------------------------------------------------
// Transak's staging environment does not deliver Stellar test assets. This
// endpoint makes that limit explicit while proving the wallet funding leg on
// chain: our Testnet issuer sends test USDC to the demo wallet.
router.post('/demo-fund', async (req, res) => {
  try {
    const amountUsdc = Number(req.body.amountUsdc || 0);
    if (!Number.isFinite(amountUsdc) || amountUsdc < 1 || amountUsdc > 5000) {
      return res.status(400).json({ success: false, message: 'Demo funding amount must be between 1 and 5,000 USDC' });
    }
    if (config.stellar.network !== 'TESTNET') {
      return res.status(400).json({ success: false, message: 'Demo funding is available only on Stellar Testnet' });
    }

    const wallet = await db.getWallet();
    if (!wallet) return res.status(400).json({ success: false, message: 'No demo wallet found. Restart the backend to create one.' });

    const stellarTxHash = await stellar.mintTestUsdc(wallet.secretKey, amountUsdc);
    if (!stellarTxHash) {
      return res.status(502).json({ success: false, message: 'Stellar Testnet did not accept the funding transaction. No balance was changed.' });
    }
    const proof = await stellar.getTransactionProof(stellarTxHash);
    const balance = await stellar.getBalance(wallet.publicKey);
    await db.updateWalletBalance(wallet.publicKey, balance.usdc, balance.xlm);
    const tx = await db.createTransaction({
      type: 'received', amountUsdc, amountUgx: 0, rate: 0,
      recipientName: 'HomeWard demo wallet', recipientPhone: '', status: 'completed',
      purpose: 'Demo funding — simulated MoneyGram AED cash-in to USDC',
      stellarTxHash, kotaniStatus: 'NOT_APPLICABLE',
    });
    await db.createNotification({ category: 'payment', title: 'Testnet cash-in complete', body: `${amountUsdc.toFixed(2)} USDC is available in your HomeWard wallet.` });
    notifyChange();

    res.json({
      success: true,
      data: {
        transaction: tx, balance: balance.usdc, proof,
        fundingMode: 'SIMULATED_FIAT_REAL_STELLAR_TESTNET',
        message: `Demo funding complete: ${amountUsdc.toFixed(2)} test USDC was issued on Stellar Testnet.`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ Demo funding error: ${msg}`);
    res.status(500).json({ success: false, message: `Demo funding failed: ${msg}` });
  }
});

// GET /api/transfer/proof/:hash — independent, live Horizon verification
router.get('/proof/:hash', async (req, res) => {
  try {
    const proof = await stellar.getTransactionProof(req.params.hash);
    res.json({ success: true, data: proof });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('not yet') ? 404 : 400).json({ success: false, message: msg });
  }
});

// ---------------------------------------------------------------------------
// GET /api/transfer/quote?amount=XXX
// ---------------------------------------------------------------------------

router.get('/quote', async (req, res) => {
  try {
    const amount = parseFloat(req.query.amount as string);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }
    if (amount < config.homeward.minTransferUsdc) {
      return res.status(400).json({
        success: false,
        message: `Minimum transfer is ${config.homeward.minTransferUsdc} USDC`,
      });
    }
    if (amount > config.homeward.maxTransferUsdc) {
      return res.status(400).json({
        success: false,
        message: `Maximum transfer is ${config.homeward.maxTransferUsdc} USDC`,
      });
    }

    const rate = await getExchangeRate();
    const quote = calculateQuote(amount, rate);
    res.json({ success: true, data: quote });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// ---------------------------------------------------------------------------
// POST /api/transfer/offramp — Send USDC → Mobile Money (Uganda)
// ---------------------------------------------------------------------------

router.post('/offramp', async (req, res) => {
  try {
    const { amountUsdc, recipientName, recipientPhone, recipientNetwork, purpose, goalId, senderName, senderPhone, confirmSelfSend } = req.body;

    const errors: string[] = [];
    if (!amountUsdc || amountUsdc <= 0) errors.push('Valid amountUsdc required');
    if (!recipientName || !recipientName.trim()) errors.push('recipientName required');
    if (!recipientPhone || !recipientPhone.trim()) errors.push('recipientPhone required for Mobile Money and SMS notification');
    if (recipientPhone && !/^\+[1-9]\d{7,14}$/.test(recipientPhone.trim())) errors.push('recipientPhone must use E.164 format (e.g. +256712345678)');
    if (!purpose || !purpose.trim()) errors.push('purpose required');
    if (amountUsdc < config.homeward.minTransferUsdc) errors.push(`Minimum transfer is ${config.homeward.minTransferUsdc} USDC`);
    if (amountUsdc > config.homeward.maxTransferUsdc) errors.push(`Maximum transfer is ${config.homeward.maxTransferUsdc} USDC`);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    // Self-send guard
    if (recipientPhone && senderPhone && recipientPhone.trim() === senderPhone.trim() && !confirmSelfSend) {
      return res.status(400).json({
        success: false,
        message: 'You are sending money to your own phone number. Send the request again to confirm you want to send to yourself.',
        selfSend: true,
      });
    }

    const wallet = await db.getWallet();
    if (!wallet) {
      return res.status(400).json({ success: false, message: 'No wallet found. Create a wallet first.' });
    }

    // Validate balance via Stellar (live)
    const balance = await stellar.getBalance(wallet.publicKey);
    if (amountUsdc > balance.usdc) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. You have $${balance.usdc.toFixed(2)} USDC but trying to send $${amountUsdc.toFixed(2)}.`,
        data: { balance: balance.usdc, shortfall: amountUsdc - balance.usdc },
      });
    }

    const rate = await getExchangeRate();
    const quote = calculateQuote(amountUsdc, rate);
    const referenceId = kotani.generateReferenceId();

    // Step 1: Determine destination address
    const kotaniEscrow = config.kotani.escrowAddress;
    const hasKotaniApiKey = !!config.kotani.apiKey;
    const destination = hasKotaniApiKey && stellar.isValidPublicKey(kotaniEscrow)
      ? kotaniEscrow
      : config.stellar.usdcIssuer; // demo mode → send to self-managed issuer (real balance deduction)

    // Step 2: Submit USDC payment on Stellar
    let stellarTxHash = '';
    try {
      await stellar.ensureTrustline(wallet.secretKey);
      if (!stellar.isValidPublicKey(destination)) {
        throw new Error(`Invalid destination address: ${destination}`);
      }
      stellarTxHash = await stellar.submitPayment(
        wallet.secretKey, destination, quote.sendAmountUsdc.toFixed(7), referenceId,
      );
      console.log(`  ✅ Stellar payment sent: ${stellarTxHash.slice(0, 8)}... (${quote.sendAmountUsdc} USDC → ${destination.slice(0, 8)}...)`);
    } catch (stellarErr) {
      const msg = stellarErr instanceof Error ? stellarErr.message : String(stellarErr);
      console.error(`  ❌ Stellar payment failed: ${msg}`);
      return res.status(502).json({
        success: false,
        message: `Stellar Testnet rejected the transfer. No payout request was created: ${msg}`,
      });
    }

    // Step 3: Sync wallet balance to DB after payment
    const newBalance = await stellar.getBalance(wallet.publicKey);
    await db.updateWalletBalance(wallet.publicKey, newBalance.usdc, newBalance.xlm);
    notifyChange();

    // Step 4: Submit offramp request to Kotani Pay
    const kotaniResult = await kotani.createOfframp({
      referenceId, cryptoAmount: quote.sendAmountUsdc, currency: 'UGX',
      chain: 'STELLAR', token: 'USDC',
      transactionHash: stellarTxHash,
      callbackUrl: `${req.protocol}://${req.get('host')}/api/transfer/webhook`,
    });

    // Stellar Testnet has no real UGX settlement. Treat a confirmed on-chain
    // transaction as a completed simulation so the demo history matches its
    // receipt and SMS. Production retains pending webhook/status handling.
    const isTestnetSimulation = config.stellar.network === 'TESTNET';
    const transactionStatus = isTestnetSimulation ? 'completed' : 'pending';
    const payoutStatus = isTestnetSimulation
      ? 'SIMULATED_COMPLETED'
      : kotaniResult.data?.status || 'PENDING';

    // Step 5: Create transaction record in DB
    const tx = await db.createTransaction({
      type: 'sent', amountUsdc: quote.sendAmountUsdc, amountUgx: quote.receiveAmountUgx,
      rate: quote.rate, recipientName: recipientName.trim(), recipientPhone: recipientPhone || '',
      recipientNetwork: (recipientNetwork as 'MTN' | 'AIRTEL') || 'MTN',
      status: transactionStatus, purpose: purpose.trim(), stellarTxHash,
      kotaniReferenceId: referenceId, kotaniStatus: payoutStatus,
      goalId: goalId || undefined,
    });
    await db.createNotification({
      category: 'payment',
      title: transactionStatus === 'completed' ? 'Money sent successfully' : 'Transfer is being processed',
      body: `UGX ${quote.receiveAmountUgx.toLocaleString()} ${transactionStatus === 'completed' ? 'was sent to' : 'is on its way to'} ${recipientName.trim()}.`,
    });

    // Step 6: Contribute to goal if goalId provided
    if (goalId) {
      await db.contributeToGoal(goalId, quote.receiveAmountUgx);
    }

    // Step 7: Send response immediately — SMS is fire-and-forget.
    // recipientPhone is validated above, so this path is never silently skipped.
    const fromName = (senderName || '').trim() || recipientName.trim();
    sendTransferNotificationAsync({
      phoneNumber: recipientPhone.trim(),
      recipientName: recipientName.trim(),
      amountUgx: quote.receiveAmountUgx,
      amountUsdc: quote.sendAmountUsdc,
      senderName: fromName,
    });

    res.json({
      success: true,
      data: {
        transaction: tx,
        quote,
        kotaniReferenceId: referenceId,
        stellarTxHash,
        stellarExplorerUrl: stellar.getExplorerTransactionUrl(stellarTxHash),
        stellarNetwork: config.stellar.network,
        payoutMode: isTestnetSimulation ? 'SIMULATED_MOBILE_MONEY_REAL_STELLAR_TESTNET' : 'KOTANI_PARTNER',
        balance: newBalance.usdc,
        sms: null, // SMS sent async, check logs
        message: `${quote.receiveAmountUgx.toLocaleString()} UGX sent to ${recipientName.trim()} via ${recipientNetwork || 'MTN'} Mobile Money. Reference: ${referenceId.slice(-8)}`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ Offramp error: ${msg}`);
    res.status(500).json({ success: false, message: `Transfer failed: ${msg}` });
  }
});

// ---------------------------------------------------------------------------
// POST /api/transfer/onramp — Mobile Money → USDC (deposit from Uganda)
// ---------------------------------------------------------------------------

router.post('/onramp', async (req, res) => {
  try {
    const { fiatAmount, phoneNumber, network } = req.body;
    const currency = 'UGX';

    const errors: string[] = [];
    if (!fiatAmount || fiatAmount <= 0) errors.push('Valid fiatAmount required');
    if (!phoneNumber || !phoneNumber.trim()) errors.push('phoneNumber required');
    if (!network || !['MTN', 'AIRTEL'].includes(network)) errors.push('network must be MTN or AIRTEL');
    if (fiatAmount < 10000) errors.push('Minimum onramp is UGX 10,000');
    if (fiatAmount > 20000000) errors.push('Maximum onramp is UGX 20,000,000');
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    const rate = await getExchangeRate();
    const cryptoAmount = (fiatAmount / rate.usdcToUgx) * 0.98;
    const referenceId = kotani.generateReferenceId();

    const kotaniResult = await kotani.createOnramp({
      referenceId,
      fiatAmount,
      currency,
      chain: 'STELLAR',
      token: 'USDC',
      phoneNumber: phoneNumber.trim(),
      network,
    });

    const tx = await db.createTransaction({
      type: 'received',
      amountUsdc: cryptoAmount,
      amountUgx: fiatAmount,
      rate: rate.usdcToUgx,
      recipientName: phoneNumber.trim(),
      recipientPhone: phoneNumber.trim(),
      recipientNetwork: network as 'MTN' | 'AIRTEL',
      status: 'pending',
      purpose: 'Mobile Money Deposit',
      kotaniReferenceId: referenceId,
      kotaniStatus: kotaniResult.data?.status || 'pending',
    });

    res.json({
      success: true,
      data: {
        transaction: tx,
        kotaniReferenceId: referenceId,
        message: `Deposit request submitted! Pay UGX ${fiatAmount.toLocaleString()} via ${network} Mobile Money to receive ~$${cryptoAmount.toFixed(2)} USDC. Reference: ${referenceId.slice(-8)}`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: `Onramp failed: ${msg}` });
  }
});

// ---------------------------------------------------------------------------
// GET /api/transfer/status/:referenceId
// ---------------------------------------------------------------------------

router.get('/status/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;
    const tx = await db.getTransactionByKotaniRef(referenceId);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const statusResult = tx.type === 'sent'
      ? await kotani.getOfframpStatus(referenceId)
      : await kotani.getOnrampStatus(referenceId);

    if (statusResult.success && statusResult.data) {
      const ks = statusResult.data.status;
      const terminal: Record<string, 'completed' | 'failed'> = {
        SUCCESSFUL: 'completed', FAILED: 'failed', REFUNDED: 'completed',
      };
      const newStatus = terminal[ks];
      if (newStatus && tx.status === 'pending') {
        await db.updateTransaction(tx.id, { status: newStatus, kotaniStatus: ks });
        tx.status = newStatus;
        tx.kotaniStatus = ks;
      }
    }

    res.json({
      success: true,
      data: {
        transaction: tx,
        kotaniStatus: statusResult.data || null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// ---------------------------------------------------------------------------
// POST /api/transfer/webhook — Kotani Pay webhook handler
// ---------------------------------------------------------------------------

router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const refId = payload.referenceId || payload.reference_id;
    if (!refId) return res.status(400).json({ success: false, message: 'Missing referenceId' });

    const tx = await db.getTransactionByKotaniRef(refId);
    if (tx) {
      const eventStatus: Record<string, string> = {
        'offramp.completed': 'SUCCESSFUL',
        'offramp.failed': 'FAILED',
        'onramp.completed': 'SUCCESSFUL',
        'onramp.failed': 'FAILED',
      };
      const ks = eventStatus[payload.event] || payload.status;
      const terminal: Record<string, 'completed' | 'failed'> = {
        SUCCESSFUL: 'completed', FAILED: 'failed', REFUNDED: 'completed',
      };
      const newStatus = terminal[ks];
      if (newStatus) {
        await db.updateTransaction(tx.id, {
          status: newStatus,
          kotaniStatus: ks,
          stellarTxHash: payload.transactionHash || tx.stellarTxHash,
        });
      }
    }

    res.json({ success: true, message: 'Webhook received' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// ---------------------------------------------------------------------------
// POST /api/transfer/retry/:referenceId
// ---------------------------------------------------------------------------

router.post('/retry/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;
    const tx = await db.getTransactionByKotaniRef(referenceId);

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    if (tx.status !== 'failed') {
      return res.status(400).json({ success: false, message: 'Only failed transactions can be retried' });
    }

    await db.updateTransaction(tx.id, { status: 'pending', kotaniStatus: 'pending' });
    tx.status = 'pending';
    tx.kotaniStatus = 'pending';

    if (tx.type === 'sent') {
      const kotaniResult = await kotani.createOfframp({
        referenceId: kotani.generateReferenceId(),
        cryptoAmount: tx.amountUsdc,
        currency: 'UGX',
        chain: 'STELLAR',
        token: 'USDC',
        transactionHash: tx.stellarTxHash,
      });
      const newRefId = kotaniResult.data?.referenceId || tx.kotaniReferenceId;
      await db.updateTransaction(tx.id, { kotaniReferenceId: newRefId });
      tx.kotaniReferenceId = newRefId;
    }

    res.json({ success: true, data: { transaction: tx }, message: 'Retry submitted' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// ---------------------------------------------------------------------------
// GET /api/transfer/kotani-balance
// ---------------------------------------------------------------------------

router.get('/kotani-balance', async (_req, res) => {
  try {
    const result = await kotani.getMerchantBalance();
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

export default router;
