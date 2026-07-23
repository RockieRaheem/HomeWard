import {
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
  Horizon,
  Memo,
} from '@stellar/stellar-sdk';
import config from '../config.js';
import type { WalletInfo, Transaction, StellarPayment, StellarAccountInfo, StellarFeeStats, StellarTrustline } from '../types/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_RESERVE_XLM = 1;
const TRUSTLINE_RESERVE_XLM = 0.5;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const SUBMIT_TIMEOUT_MS = 30000;
const TX_TIMEOUT_SECONDS = 300;

// ---------------------------------------------------------------------------
// Server & Dynamic Asset
// ---------------------------------------------------------------------------

const server = new Horizon.Server(config.stellar.horizonUrl);

function getNetworkPassphrase(): string {
  return config.stellar.network === 'TESTNET' ? Networks.TESTNET : Networks.PUBLIC;
}

function isTestnet(): boolean {
  return config.stellar.network === 'TESTNET';
}

function getUsdcAsset(): Asset {
  return new Asset('USDC', config.stellar.usdcIssuer);
}

// ---------------------------------------------------------------------------
// Fee estimation
// ---------------------------------------------------------------------------

let cachedFeeStats: StellarFeeStats | null = null;
let lastFeeFetch = 0;

export async function getRecommendedFee(): Promise<StellarFeeStats> {
  const now = Date.now();
  if (cachedFeeStats && now - lastFeeFetch < 30000) return cachedFeeStats;

  try {
    const stats: any = await server.feeStats();

    const result: StellarFeeStats = {
      lastLedger: stats.last_ledger,
      lastLedgerBaseFee: parseInt(String(stats.last_ledger_base_fee)) || 100,
      modeAcceptedFee: parseInt(String(stats.mode_accepted_fee)) || 100,
      minAcceptedFee: parseInt(String(stats.min_accepted_fee)) || 100,
      maxFee: 100 * (parseInt(String(stats.max_fee?.mode)) || 100),
      feeCharged: {
        max: parseInt(String(stats.fee_charged?.max)) || 100,
        min: parseInt(String(stats.fee_charged?.min)) || 100,
        mode: parseInt(String(stats.fee_charged?.mode)) || 100,
        p10: parseInt(String(stats.fee_charged?.p10)) || 100,
        p20: parseInt(String(stats.fee_charged?.p20)) || 100,
        p30: parseInt(String(stats.fee_charged?.p30)) || 100,
        p40: parseInt(String(stats.fee_charged?.p40)) || 100,
        p50: parseInt(String(stats.fee_charged?.p50)) || 100,
        p60: parseInt(String(stats.fee_charged?.p60)) || 100,
        p70: parseInt(String(stats.fee_charged?.p70)) || 100,
        p80: parseInt(String(stats.fee_charged?.p80)) || 100,
        p90: parseInt(String(stats.fee_charged?.p90)) || 100,
        p95: parseInt(String(stats.fee_charged?.p95)) || 100,
        p99: parseInt(String(stats.fee_charged?.p99)) || 100,
      },
      ledgerCapacityUsage: stats.ledger_capacity_usage,
      recommendedFee: parseInt(String(stats.fee_charged?.p50)) || 100,
    };

    cachedFeeStats = result;
    lastFeeFetch = now;
    return result;
  } catch {
    const fallback: StellarFeeStats = {
      lastLedger: 0,
      lastLedgerBaseFee: 100,
      modeAcceptedFee: 100,
      minAcceptedFee: 100,
      maxFee: 1000,
      feeCharged: {} as any,
      ledgerCapacityUsage: 0,
      recommendedFee: 100,
    };
    cachedFeeStats = fallback;
    lastFeeFetch = now;
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Account cache
// ---------------------------------------------------------------------------

const accountCache = new Map<string, { account: any; fetchedAt: number }>();

function getCachedAccount(publicKey: string): any | null {
  const entry = accountCache.get(publicKey);
  if (entry && Date.now() - entry.fetchedAt < 10000) return entry.account;
  return null;
}

function setCachedAccount(publicKey: string, account: any): void {
  accountCache.set(publicKey, { account, fetchedAt: Date.now() });
  if (accountCache.size > 100) {
    const oldest = accountCache.keys().next().value;
    if (oldest) accountCache.delete(oldest);
  }
}

async function loadAccount(publicKey: string): Promise<any> {
  const cached = getCachedAccount(publicKey);
  if (cached) return cached;

  const account = await server.loadAccount(publicKey);
  setCachedAccount(publicKey, account);
  return account;
}

export function clearAccountCache(publicKey: string): void {
  accountCache.delete(publicKey);
}

// ---------------------------------------------------------------------------
// Account info
// ---------------------------------------------------------------------------

export async function getAccountInfo(publicKey: string): Promise<StellarAccountInfo> {
  try {
    const account = await server.loadAccount(publicKey);
    const balances = account.balances as Array<any>;

    let xlmBalance = 0;
    const trustlines: StellarTrustline[] = [];

    for (const b of balances) {
      if (b.asset_type === 'native') {
        xlmBalance = parseFloat(b.balance);
      } else {
        trustlines.push({
          assetCode: b.asset_code,
          assetIssuer: b.asset_issuer,
          balance: b.balance,
          limit: b.limit || '0',
          isAuthorized: b.is_authorized !== false,
        });
      }
    }

    const subentryCount = account.subentry_count || 0;
    const xlmReserve = BASE_RESERVE_XLM + (subentryCount * TRUSTLINE_RESERVE_XLM);
    const availableXlm = Math.max(0, xlmBalance - xlmReserve);

    return {
      publicKey,
      sequence: account.sequence,
      subentryCount,
      balances,
      signers: (account.signers || []).map((s: any) => ({
        key: s.key,
        weight: s.weight,
        type: s.type,
      })),
      thresholds: {
        lowThreshold: account.thresholds?.low_threshold || 0,
        medThreshold: account.thresholds?.med_threshold || 0,
        highThreshold: account.thresholds?.high_threshold || 0,
      },
      isFunded: xlmBalance > 0,
      xlmReserve,
      availableXlm,
    };
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return {
        publicKey,
        sequence: '0',
        subentryCount: 0,
        balances: [],
        signers: [],
        thresholds: { lowThreshold: 0, medThreshold: 0, highThreshold: 0 },
        isFunded: false,
        xlmReserve: BASE_RESERVE_XLM,
        availableXlm: 0,
      };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Test USDC issuer — creates a self-managed USDC issuer on testnet
// ---------------------------------------------------------------------------

export async function initializeTestUsdc(): Promise<void> {
  if (!isTestnet()) return;
  // Only skip if user provided BOTH an issuer address AND its secret key
  if (process.env.USDC_ISSUER && process.env.USDC_ISSUER_SECRET) return;

  console.log(`  🔄 Initializing test USDC...`);

  // Step 1: Create issuer keypair
  const issuer = Keypair.random();
  const issuerPublic = issuer.publicKey();
  const issuerSecret = issuer.secret();

  // Step 2: Fund issuer via Friendbot
  try {
    const fbResponse = await fetch(
      `https://friendbot.stellar.org?addr=${issuerPublic}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!fbResponse.ok) {
      const errBody = await fbResponse.text().catch(() => '');
      throw new Error(`Friendbot returned ${fbResponse.status}: ${errBody}`);
    }
    console.log(`  ✅ Issuer funded: ${issuerPublic.slice(0, 8)}...`);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.log(`  ⚠️  Issuer funding timed out. USDC will be $0.`);
      return;
    }
    console.log(`  ⚠️  Issuer funding failed: ${err.message}`);
    return;
  }

  // Step 3: Update config to use our issuer
  config.stellar.usdcIssuer = issuerPublic;
  config.stellar.usdcIssuerSecret = issuerSecret;
  config.testUsdc.issuerSecret = issuerSecret;

  console.log(`  ✅ USDC issuer set to self-managed account`);
}

// ---------------------------------------------------------------------------
// Mint test USDC to wallet
// ---------------------------------------------------------------------------

export async function mintTestUsdc(walletSecret: string, amount: number = config.testUsdc.initialMintAmount): Promise<string | null> {
  if (!isTestnet()) return null;
  if (!config.testUsdc.issuerSecret) {
    console.log(`  ⚠️  No test USDC issuer configured. Skipping mint.`);
    return null;
  }

  const walletKeypair = Keypair.fromSecret(walletSecret);
  const walletPublic = walletKeypair.publicKey();
  const issuerKeypair = Keypair.fromSecret(config.testUsdc.issuerSecret);
  const issuerPublic = config.stellar.usdcIssuer;

  console.log(`  🔄 Minting ${amount} test USDC to wallet...`);

  // Step 1: Ensure wallet has trustline to our USDC
  try {
    await ensureTrustline(walletSecret);
  } catch (err: any) {
    console.log(`  ⚠️  Trustline setup: ${err.message}`);
    return null;
  }

  // Step 2: Issuer sends USDC to wallet
  try {
    clearAccountCache(issuerPublic);
    const issuerAccount = await loadAccount(issuerPublic);

    const feeStats = await getRecommendedFee();
    const fee = Math.max(feeStats.recommendedFee, 100).toString();

    const tx = new TransactionBuilder(issuerAccount, {
      fee,
      networkPassphrase: getNetworkPassphrase(),
    })
      .addOperation(Operation.payment({
        destination: walletPublic,
        asset: getUsdcAsset(),
        amount: amount.toFixed(7),
      }))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    tx.sign(issuerKeypair);
    const result = await server.submitTransaction(tx);

    clearAccountCache(issuerPublic);
    clearAccountCache(walletPublic);

    console.log(`  ✅ Minted ${amount} USDC to wallet (tx: ${result.hash.slice(0, 8)}...)`);
    return result.hash;
  } catch (err: any) {
    const msg = extractStellarError(err);
    console.log(`  ⚠️  USDC mint failed: ${msg}`);
    return null;
  }
}

/** URLs are generated here so the app never guesses which Stellar network was used. */
export function getExplorerTransactionUrl(hash: string): string {
  return `https://stellar.expert/explorer/${isTestnet() ? 'testnet' : 'public'}/tx/${hash}`;
}

export function getExplorerAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/${isTestnet() ? 'testnet' : 'public'}/account/${address}`;
}

/** Read an already-submitted transaction back from Horizon; never fabricate proof. */
export async function getTransactionProof(hash: string): Promise<{
  hash: string; ledger: number; createdAt: string; successful: boolean;
  memo: string | null; memoType: string | null; sourceAccount: string;
  explorerUrl: string; network: 'TESTNET' | 'PUBLIC';
}> {
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('Invalid Stellar transaction hash');
  const response = await fetch(`${config.stellar.horizonUrl}/transactions/${hash}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'Transaction is not yet available on Horizon' : `Horizon returned ${response.status}`);
  }
  const tx = await response.json() as any;
  return {
    hash: tx.hash, ledger: Number(tx.ledger ?? 0), createdAt: tx.created_at,
    successful: Boolean(tx.successful), memo: tx.memo || null, memoType: tx.memo_type || null,
    sourceAccount: tx.source_account, explorerUrl: getExplorerTransactionUrl(tx.hash),
    network: isTestnet() ? 'TESTNET' : 'PUBLIC',
  };
}

// ---------------------------------------------------------------------------
// Wallet creation
// ---------------------------------------------------------------------------

export async function createWallet(): Promise<WalletInfo> {
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  const secretKey = keypair.secret();

  let isFunded = false;

  if (isTestnet()) {
    try {
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${publicKey}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Friendbot returned ${response.status}: ${errorBody}`);
      }
      const json = await response.json() as any;
      if (!json?.hash) {
        const detail = json?.detail || json?.title || 'empty response';
        throw new Error(`Friendbot funding failed: ${detail}`);
      }
      isFunded = true;
      clearAccountCache(publicKey);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('Friendbot request timed out. The testnet faucet may be slow. Try again.');
      }
      throw err;
    }
  }

  const balance = await getBalance(publicKey);

  const wallet: WalletInfo = {
    publicKey,
    secretKey,
    balanceUsdc: balance.usdc,
    balanceXlm: balance.xlm,
    isFunded,
  };

  return wallet;
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export async function getBalance(address: string): Promise<{ usdc: number; xlm: number }> {
  try {
    const account = await server.loadAccount(address);
    let usdc = 0;
    let xlm = 0;

    for (const b of account.balances) {
      const bal = b as any;
      if (bal.asset_type === 'native') {
        xlm = parseFloat(bal.balance);
      } else if (bal.asset_code === 'USDC' && bal.asset_issuer === config.stellar.usdcIssuer) {
        usdc = parseFloat(bal.balance);
      }
    }

    return { usdc, xlm };
  } catch {
    return { usdc: 0, xlm: 0 };
  }
}

// ---------------------------------------------------------------------------
// Trustline management
// ---------------------------------------------------------------------------

async function hasTrustline(publicKey: string): Promise<boolean> {
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.some(
      (b: any) => b.asset_code === 'USDC' && b.asset_issuer === config.stellar.usdcIssuer
    );
  } catch {
    return false;
  }
}

export async function ensureTrustline(secretKey: string): Promise<void> {
  const keypair = Keypair.fromSecret(secretKey);
  const publicKey = keypair.publicKey();

  const alreadyExists = await hasTrustline(publicKey);
  if (alreadyExists) return;

  try {
    const account = await server.loadAccount(publicKey);
    const nativeBalance = account.balances.find((b: any) => b.asset_type === 'native');
    const xlmBalance = nativeBalance ? parseFloat(nativeBalance.balance) : 0;
    const subentryCount = account.subentry_count || 0;
    const neededReserve = BASE_RESERVE_XLM + ((subentryCount + 1) * TRUSTLINE_RESERVE_XLM);

    if (xlmBalance < neededReserve) {
      const shortfall = neededReserve - xlmBalance;
      let msg = `Insufficient XLM to add USDC trustline. `;
      msg += `Need ${neededReserve} XLM (${BASE_RESERVE_XLM} base + ${subentryCount + 1} entries × ${TRUSTLINE_RESERVE_XLM}). `;
      msg += `Have ${xlmBalance} XLM. Shortfall: ${shortfall.toFixed(1)} XLM.`;
      if (isTestnet()) {
        msg += ' Use Friendbot to get free XLM.';
      }
      throw new Error(msg);
    }
  } catch (err: any) {
    if (err?.message?.includes('Insufficient XLM')) throw err;
  }

  const account = await loadAccount(publicKey);
  const feeStats = await getRecommendedFee();
  const fee = Math.max(feeStats.recommendedFee, 100).toString();

  const tx = new TransactionBuilder(account, {
    fee,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(Operation.changeTrust({
      asset: getUsdcAsset(),
      limit: '922337203685.4775807',
    }))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  tx.sign(keypair);

  try {
    await server.submitTransaction(tx);
    clearAccountCache(publicKey);
  } catch (err: any) {
    const stellarErr = extractStellarError(err);
    throw new Error(`Trustline creation failed: ${stellarErr}`);
  }
}

// ---------------------------------------------------------------------------
// Payment submission
// ---------------------------------------------------------------------------

export async function submitPayment(
  secretKey: string,
  destination: string,
  amountUsdc: string,
  memoText?: string
): Promise<string> {
  const keypair = Keypair.fromSecret(secretKey);
  const publicKey = keypair.publicKey();

  try {
    Keypair.fromPublicKey(destination);
  } catch {
    throw new Error(`Invalid destination address: ${destination}`);
  }

  clearAccountCache(publicKey);
  const account = await loadAccount(publicKey);

  const balance = await getBalance(publicKey);
  const amountNum = parseFloat(amountUsdc);
  if (amountNum > balance.usdc) {
    throw new Error(
      `Insufficient USDC balance. Have ${balance.usdc.toFixed(2)} USDC, trying to send ${amountNum.toFixed(2)} USDC.`
    );
  }

  const feeStats = await getRecommendedFee();
  const fee = Math.max(feeStats.recommendedFee * 2, 100).toString();

  const txBuilder = new TransactionBuilder(account, {
    fee,
    networkPassphrase: getNetworkPassphrase(),
  });

  if (memoText) {
    txBuilder.addMemo(Memo.text(memoText));
  }

  txBuilder
    .addOperation(Operation.payment({
      destination,
      asset: getUsdcAsset(),
      amount: amountUsdc,
    }))
    .setTimeout(TX_TIMEOUT_SECONDS);

  const tx = txBuilder.build();
  tx.sign(keypair);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await server.submitTransaction(tx);
      clearAccountCache(publicKey);
      return result.hash;
    } catch (err: any) {
      lastError = err;
      const stellarErr = extractStellarError(err);

      if (isTerminalError(err)) {
        throw new Error(`Payment failed: ${stellarErr}`);
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        try {
          clearAccountCache(publicKey);
          const freshAccount = await loadAccount(publicKey);
          const retryBuilder = new TransactionBuilder(freshAccount, {
            fee,
            networkPassphrase: getNetworkPassphrase(),
          });
          if (memoText) retryBuilder.addMemo(Memo.text(memoText));
          retryBuilder
            .addOperation(Operation.payment({
              destination,
              asset: getUsdcAsset(),
              amount: amountUsdc,
            }))
            .setTimeout(TX_TIMEOUT_SECONDS);
          const retryTx = retryBuilder.build();
          retryTx.sign(keypair);
        } catch {
          // continue
        }
      }
    }
  }

  throw lastError || new Error('Payment submission failed after all retries');
}

// ---------------------------------------------------------------------------
// Transaction history
// ---------------------------------------------------------------------------

export async function getStellarPayments(
  address: string,
  limit = 50,
  cursor?: string
): Promise<{ payments: StellarPayment[]; cursor: string }> {
  try {
    const builder = server
      .payments()
      .forAccount(address)
      .limit(limit)
      .order('desc');

    if (cursor) builder.cursor(cursor);

    const page = await builder.call();

    const payments: StellarPayment[] = page.records.map((p: any) => ({
      id: p.id,
      pagingToken: p.paging_token || '',
      transactionHash: p.transaction_hash,
      operationId: p.id,
      type: p.type,
      assetType: p.asset_type || 'native',
      assetCode: p.asset_code,
      assetIssuer: p.asset_issuer,
      from: p.from,
      to: p.to,
      amount: p.amount || '0',
      createdAt: p.created_at,
      isReceived: p.to === address,
    }));

    return {
      payments,
      cursor: page.records.length > 0
        ? page.records[page.records.length - 1].paging_token
        : cursor || '',
    };
  } catch {
    return { payments: [], cursor: cursor || '' };
  }
}

export async function getRecentTransactions(address: string, limit = 20): Promise<any[]> {
  try {
    const { payments } = await getStellarPayments(address, limit);
    return payments.map((p) => ({
      id: p.id,
      type: p.isReceived ? 'received' : 'sent',
      amount: p.amount,
      asset: p.assetCode || 'XLM',
      from: p.from,
      to: p.to,
      createdAt: p.createdAt,
      txHash: p.transactionHash,
      memo: p.memo,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Wallet restoration
// ---------------------------------------------------------------------------

export async function restoreWallet(secretKey: string): Promise<WalletInfo> {
  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(secretKey);
  } catch {
    throw new Error('Invalid secret key format. Please check and try again.');
  }

  const publicKey = keypair.publicKey();
  const balance = await getBalance(publicKey);

  let isFunded = false;
  try {
    await server.loadAccount(publicKey);
    isFunded = true;
  } catch {
    isFunded = false;
  }

  const wallet: WalletInfo = {
    publicKey,
    secretKey,
    balanceUsdc: balance.usdc,
    balanceXlm: balance.xlm,
    isFunded,
  };

  return wallet;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function isValidPublicKey(address: string): boolean {
  try {
    Keypair.fromPublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export function generateKeypair(): { publicKey: string; secretKey: string } {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secretKey: kp.secret() };
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function extractStellarError(err: any): string {
  if (err?.response?.data) {
    const data = err.response.data;
    const resultCodes = data.extras?.result_codes;
    if (resultCodes) {
      const txCode = resultCodes.transaction;
      const opCodes = resultCodes.operations;
      if (txCode) {
        let msg = transactionResultCodeMessage(txCode);
        if (opCodes?.length) {
          const opMessages = opCodes.map((c: string) => operationResultCodeMessage(c));
          msg += ` (operations: ${opMessages.join(', ')})`;
        }
        return msg;
      }
    }
    return data.detail || data.title || `Horizon error ${err.response.status}`;
  }

  if (err?.name === 'AbortError') {
    return 'Request timed out. The Stellar network may be congested.';
  }

  if (err?.message) {
    const msg = err.message;
    if (msg.includes('tx_bad_seq')) return 'Transaction sequence error. Please try again.';
    if (msg.includes('tx_too_late')) return 'Transaction expired. Please try again.';
    if (msg.includes('tx_no_source_account')) return 'Source account does not exist on the network.';
    return msg;
  }

  return 'Unknown Stellar error';
}

function isTerminalError(err: any): boolean {
  const msg = extractStellarError(err).toLowerCase();
  const terminal = [
    'insufficient balance',
    'op_underfunded',
    'op_no_trust',
    'op_src_not_authorized',
    'op_not_authorized',
    'op_line_full',
    'invalid address',
    'tx_bad_seq',
    'tx_too_late',
    'tx_no_source_account',
    'tx_insufficient_fee',
    'invalid secret key',
  ];
  return terminal.some((t) => msg.includes(t));
}

function transactionResultCodeMessage(code: string): string {
  const map: Record<string, string> = {
    tx_failed: 'Transaction failed',
    tx_too_early: 'Transaction too early',
    tx_too_late: 'Transaction expired',
    tx_missing_operation: 'No operations',
    tx_bad_seq: 'Bad sequence number',
    tx_bad_auth: 'Invalid authorization',
    tx_insufficient_balance: 'Insufficient balance for fees',
    tx_no_source_account: 'Source account does not exist',
    tx_insufficient_fee: 'Fee too low',
    tx_bad_auth_extra: 'Unused signers present',
    tx_fee_bump_inner_failed: 'Inner transaction failed',
  };
  return map[code] || code;
}

function operationResultCodeMessage(code: string): string {
  const map: Record<string, string> = {
    op_inner: 'Inner operation failed',
    op_bad_auth: 'Bad authorization',
    op_no_source: 'Source account does not exist',
    op_not_authorized: 'Not authorized',
    op_underfunded: 'Insufficient funds',
    op_no_trust: 'No trustline',
    op_src_not_authorized: 'Source not authorized',
    op_line_full: 'Trustline limit reached',
    op_low_reserve: 'Insufficient XLM reserve',
    op_malformed: 'Malformed operation',
    payment_no_destination: 'Destination does not exist',
    payment_no_trust: 'No destination trustline',
    payment_not_authorized: 'Destination not authorized',
    payment_line_full: 'Destination trustline limit reached',
    payment_src_no_trust: 'Source has no trustline',
  };
  return map[code] || code;
}
