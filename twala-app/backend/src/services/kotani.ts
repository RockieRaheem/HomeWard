import config from '../config.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function apiUrl(): string {
  return config.kotani.useSandbox ? config.kotani.sandboxUrl : config.kotani.productionUrl;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.kotani.apiKey}`,
  };
}

function isLive(): boolean {
  return !!config.kotani.apiKey;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KotaniResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

export interface KotaniCustomer {
  id: string;
  phone_number: string;
  country_code: string;
  network?: string;
  first_name?: string;
  last_name?: string;
  account_name?: string;
  email?: string;
}

export interface CreateCustomerParams {
  phoneNumber: string;
  countryCode: string;
  network?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface OfframpRateParams {
  from: 'USDC' | 'USDT' | 'CUSD';
  to: 'KES' | 'UGX' | 'NGN' | 'GHS' | 'ZAR' | 'TZS' | 'XOF' | 'ZMW';
  cryptoAmount: number;
}

export interface OfframpRateData {
  from: string;
  to: string;
  value: string;
  id: string;
  fiatAmount: number;
  cryptoAmount: number;
  transactionAmount: number;
  fee: number;
}

export interface CreateOfframpParams {
  referenceId: string;
  cryptoAmount: number;
  currency: string;
  chain: string;
  token: string;
  callbackUrl?: string;
  transactionHash?: string;
}

export interface OfframpData {
  referenceId: string;
  status: 'PENDING' | 'CRYPTO_RECEIVED' | 'SUCCESSFUL' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED' | 'REFUND_FAILED';
  cryptoAmount: number;
  cryptoAmountReceived: number;
  feeInCrypto: number;
  feeType?: string;
  cryptoWallet: string;
  chain: any;
  token: any;
  transactionHash?: string;
  fiatAmount?: number;
  createdAt?: string;
  updatedAt?: string;
  depositAddress?: string;
}

export interface WithdrawMobileMoneyParams {
  referenceId: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  network: string;
  callbackUrl?: string;
  customerId?: string;
}

export interface WithdrawalData {
  referenceId: string;
  status: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  fee: number;
  createdAt: string;
}

export interface BalanceData {
  asset: string;
  chain: string;
  balance: number;
  locked: number;
  available: number;
}

export interface WebhookPayload {
  event: 'offramp.completed' | 'offramp.failed' | 'onramp.completed' | 'onramp.failed';
  referenceId: string;
  status: 'SUCCESSFUL' | 'FAILED' | 'REFUNDED';
  transactionHash?: string;
  completedAt?: string;
  failureReason?: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function generateReferenceId(): string {
  return `homeward-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Demo simulation
// ---------------------------------------------------------------------------

type Callback = (referenceId: string, status: string) => void;
let _onComplete: Callback | null = null;
export function onOfframpComplete(cb: Callback): void { _onComplete = cb; }

function demoDelay(ms = 600): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

const demoOfframps = new Map<string, OfframpData>();
let demoIdCounter = 0;
function demoRefId(): string {
  return `homeward-demo-${Date.now()}-${++demoIdCounter}`;
}

async function apiCall<T>(
  method: string,
  path: string,
  body?: any,
): Promise<KotaniResponse<T>> {
  try {
    const res = await fetch(`${apiUrl()}${path}`, {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return { success: res.ok, statusCode: res.status, message: json.message || '', data: json.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, statusCode: 0, message: `Network: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// 1. Customers
// ---------------------------------------------------------------------------

export async function createCustomer(
  params: CreateCustomerParams,
): Promise<KotaniResponse<KotaniCustomer>> {
  if (!isLive()) {
    await demoDelay();
    return {
      success: true,
      statusCode: 200,
      message: 'Customer created (demo)',
      data: { id: `demo-cust-${Date.now()}`, phone_number: params.phoneNumber, country_code: params.countryCode, network: params.network, first_name: params.firstName, last_name: params.lastName },
    };
  }
  return apiCall<KotaniCustomer>('POST', '/api/v3/customer/mobile-money', {
    phone_number: params.phoneNumber,
    country_code: params.countryCode,
    network: params.network,
    first_name: params.firstName,
    last_name: params.lastName,
    email: params.email,
  });
}

// ---------------------------------------------------------------------------
// 2. Rate Quotes
// ---------------------------------------------------------------------------

export async function getOfframpRate(
  params: OfframpRateParams,
): Promise<KotaniResponse<OfframpRateData>> {
  if (!isLive()) {
    await demoDelay(300);
    const rate = params.to === 'UGX' ? 3750 : params.to === 'KES' ? 150 : 1000;
    const fee = Math.max(params.cryptoAmount * 0.02, 1);
    const fiatAmount = Math.round((params.cryptoAmount - fee) * rate);
    return {
      success: true, statusCode: 200, message: 'Rate (demo)',
      data: {
        from: params.from, to: params.to, value: rate.toString(), id: 'demo-rate',
        fiatAmount, cryptoAmount: params.cryptoAmount, transactionAmount: fiatAmount, fee,
      },
    };
  }
  return apiCall<OfframpRateData>('POST', '/api/v3/rate/offramp', {
    from: params.from,
    to: params.to,
    cryptoAmount: params.cryptoAmount,
  });
}

// ---------------------------------------------------------------------------
// 3. Offramp — Crypto → Fiat
// ---------------------------------------------------------------------------

export async function createOfframp(
  params: CreateOfframpParams,
): Promise<KotaniResponse<OfframpData>> {
  if (!isLive()) {
    await demoDelay();
    const rate = 3750;
    const fee = Math.max(params.cryptoAmount * 0.02, 1);
    const received = params.cryptoAmount - fee;
    const data: OfframpData = {
      referenceId: params.referenceId,
      status: 'PENDING',
      cryptoAmount: params.cryptoAmount,
      cryptoAmountReceived: received,
      feeInCrypto: fee,
      cryptoWallet: 'demo-wallet-address',
      chain: params.chain,
      token: params.token,
      fiatAmount: Math.round(received * rate),
      createdAt: new Date().toISOString(),
      depositAddress: 'GBDEMO...DEPOSIT...ADDRESS',
    };
    demoOfframps.set(data.referenceId, data);

    setTimeout(() => {
      const stored = demoOfframps.get(data.referenceId);
      if (stored) {
        stored.status = 'SUCCESSFUL';
        stored.transactionHash = `demo-tx-${Date.now()}`;
        stored.updatedAt = new Date().toISOString();
        demoOfframps.set(data.referenceId, stored);
        _onComplete?.(data.referenceId, 'SUCCESSFUL');
      }
    }, 5000);

    return { success: true, statusCode: 200, message: 'Offramp created', data };
  }

  return apiCall<OfframpData>('POST', '/api/v3/offramp', {
    referenceId: params.referenceId,
    cryptoAmount: params.cryptoAmount,
    currency: params.currency,
    chain: params.chain,
    token: params.token,
    ...(params.callbackUrl ? { callbackUrl: params.callbackUrl } : {}),
    ...(params.transactionHash ? { transactionHash: params.transactionHash } : {}),
  });
}

export async function getOfframpStatus(
  referenceId: string,
): Promise<KotaniResponse<OfframpData>> {
  if (!isLive()) {
    await demoDelay(300);
    const data = demoOfframps.get(referenceId);
    if (!data) return { success: false, statusCode: 404, message: 'Not found' };
    return { success: true, statusCode: 200, message: 'OK', data };
  }
  return apiCall<OfframpData>('GET', `/api/v3/offramp/${referenceId}`);
}

// ---------------------------------------------------------------------------
// 4. Withdrawal — Direct mobile money disbursement (funds already in Kotani)
// ---------------------------------------------------------------------------

export async function withdrawMobileMoney(
  params: WithdrawMobileMoneyParams,
): Promise<KotaniResponse<WithdrawalData>> {
  if (!isLive()) {
    await demoDelay();
    return {
      success: true, statusCode: 200, message: 'Withdrawal created (demo)',
      data: {
        referenceId: params.referenceId, status: 'PENDING', amount: params.amount,
        currency: params.currency, phoneNumber: params.phoneNumber, fee: params.amount * 0.02,
        createdAt: new Date().toISOString(),
      },
    };
  }
  return apiCall<WithdrawalData>('POST', '/api/v3/withdraw/mobile-money', {
    referenceId: params.referenceId,
    amount: params.amount,
    currency: params.currency,
    phoneNumber: params.phoneNumber,
    network: params.network,
    ...(params.callbackUrl ? { callbackUrl: params.callbackUrl } : {}),
    ...(params.customerId ? { customerId: params.customerId } : {}),
  });
}

export async function getWithdrawalStatus(
  referenceId: string,
): Promise<KotaniResponse<WithdrawalData>> {
  if (!isLive()) {
    await demoDelay(300);
    return { success: true, statusCode: 200, message: 'OK (demo)', data: undefined };
  }
  return apiCall<WithdrawalData>('GET', `/api/v3/withdraw/status/${referenceId}`);
}

// ---------------------------------------------------------------------------
// 5. Balances
// ---------------------------------------------------------------------------

export async function getMerchantBalance(): Promise<KotaniResponse<BalanceData[]>> {
  if (!isLive()) {
    await demoDelay(300);
    return {
      success: true, statusCode: 200, message: 'OK',
      data: [
        { asset: 'USDC', chain: 'STELLAR', balance: 25000, locked: 3200, available: 21800 },
        { asset: 'XLM', chain: 'STELLAR', balance: 5000, locked: 0, available: 5000 },
      ],
    };
  }
  return apiCall<BalanceData[]>('GET', '/api/v3/balance');
}

// ---------------------------------------------------------------------------
// 6. Webhook Registration
// ---------------------------------------------------------------------------

export async function registerWebhook(url: string): Promise<KotaniResponse<any>> {
  if (!isLive()) {
    await demoDelay();
    return { success: true, statusCode: 200, message: 'Webhook registered (demo)' };
  }
  return apiCall<any>('POST', '/api/v3/webhook', {
    url,
    events: ['offramp.completed', 'offramp.failed', 'onramp.completed', 'onramp.failed'],
  });
}

// ---------------------------------------------------------------------------
// 7. Onramp — Fiat → Crypto (used by transfer route)
// ---------------------------------------------------------------------------

export interface OnrampData {
  referenceId: string;
  status: string;
  fiatAmount: number;
  cryptoAmount: number;
  cryptoAmountSent: number;
  feeInFiat: number;
  feeInCrypto: number;
  rate: number;
  phoneNumber: string;
  network: string;
  transactionHash: string;
  createdAt: string;
}

export async function createOnramp(params: {
  referenceId: string;
  fiatAmount: number;
  currency: string;
  chain: string;
  token: string;
  phoneNumber: string;
  network: string;
}): Promise<KotaniResponse<OnrampData>> {
  if (!isLive()) {
    await demoDelay();
    const rate = 3750;
    const fee = Math.max(params.fiatAmount * 0.02, 1000);
    const cryptoAmount = (params.fiatAmount - fee) / rate;
    return {
      success: true, statusCode: 200, message: 'Onramp created (demo)',
      data: {
        referenceId: params.referenceId, status: 'PENDING',
        fiatAmount: params.fiatAmount, cryptoAmount, cryptoAmountSent: cryptoAmount * 0.98,
        feeInFiat: fee, feeInCrypto: fee / rate, rate,
        phoneNumber: params.phoneNumber, network: params.network, transactionHash: '',
        createdAt: new Date().toISOString(),
      },
    };
  }
  return apiCall<OnrampData>('POST', '/api/v3/onramp', {
    referenceId: params.referenceId,
    fiatAmount: params.fiatAmount,
    currency: params.currency,
    chain: params.chain,
    token: params.token,
    phoneNumber: params.phoneNumber,
    network: params.network,
  });
}

export async function getOnrampStatus(
  referenceId: string,
): Promise<KotaniResponse<OnrampData>> {
  if (!isLive()) {
    await demoDelay(300);
    return { success: true, statusCode: 200, message: 'OK (demo)' };
  }
  return apiCall<OnrampData>('GET', `/api/v3/onramp/status/${referenceId}`);
}

// ---------------------------------------------------------------------------
// 8. Health check
// ---------------------------------------------------------------------------

export async function healthCheck(): Promise<KotaniResponse<any>> {
  if (!isLive()) {
    return { success: true, statusCode: 200, message: 'Demo mode' };
  }
  return apiCall<any>('GET', '/health');
}
