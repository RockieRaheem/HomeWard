import config from '../config.js';

export interface CreateTransakCheckoutInput {
  fiatAmount: number;
  walletAddress: string;
  email?: string;
  partnerUserId?: string;
  userIp: string;
}

let cachedAccessToken = '';
let accessTokenExpiresAt = 0;

export function getTransakStatus() {
  const configured = Boolean(
    config.transak.apiKey && (config.transak.apiSecret || config.transak.accessToken) && config.transak.referrerDomain
  );
  return {
    configured,
    environment: config.transak.useSandbox ? 'STAGING' : 'PRODUCTION',
    fiatCurrency: config.transak.fiatCurrency,
    cryptoCurrencyCode: config.transak.cryptoCurrencyCode,
    // Staging is useful for KYC/card UX testing but cannot settle USDC on Stellar Testnet.
    canSettleToCurrentWallet: configured && !config.transak.useSandbox && config.stellar.network === 'PUBLIC',
  };
}

async function getPartnerAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < accessTokenExpiresAt - 60_000) return cachedAccessToken;
  if (!config.transak.apiSecret) {
    if (!config.transak.accessToken) throw new Error('Set TRANSAK_API_SECRET (recommended) or TRANSAK_ACCESS_TOKEN on the backend.');
    return config.transak.accessToken;
  }

  const apiBase = config.transak.useSandbox ? 'https://api-stg.transak.com' : 'https://api.transak.com';
  const response = await fetch(`${apiBase}/partners/api/v2/refresh-token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': config.transak.apiKey,
      'api-secret': config.transak.apiSecret,
    },
    body: JSON.stringify({ apiKey: config.transak.apiKey }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => null) as any;
  if (!response.ok || !body?.data?.accessToken) {
    throw new Error(body?.message || body?.error?.message || 'Unable to refresh Transak partner access token');
  }
  cachedAccessToken = body.data.accessToken;
  accessTokenExpiresAt = Number(body.data.expiresAt || 0) * 1000 || Date.now() + (6 * 24 * 60 * 60 * 1000);
  return cachedAccessToken;
}

/** Creates a single-use Transak widget URL. The partner access token remains server-side. */
export async function createCheckout(input: CreateTransakCheckoutInput): Promise<{ widgetUrl: string; expiresInSeconds: number }> {
  const status = getTransakStatus();
  if (!status.configured) {
    throw new Error('Transak is not configured. Set TRANSAK_API_KEY, TRANSAK_ACCESS_TOKEN and TRANSAK_REFERRER_DOMAIN on the backend.');
  }
  if (!Number.isFinite(input.fiatAmount) || input.fiatAmount <= 0) throw new Error('A valid fiat amount is required');
  if (!/^G[A-Z2-7]{55}$/.test(input.walletAddress)) throw new Error('A valid Stellar wallet address is required');

  const accessToken = await getPartnerAccessToken();
  const baseUrl = config.transak.useSandbox
    ? 'https://api-gateway-stg.transak.com'
    : 'https://api-gateway.transak.com';
  const widgetParams: Record<string, unknown> = {
    apiKey: config.transak.apiKey,
    referrerDomain: config.transak.referrerDomain,
    productsAvailed: 'BUY',
    fiatAmount: String(input.fiatAmount),
    fiatCurrency: config.transak.fiatCurrency,
    cryptoCurrencyCode: config.transak.cryptoCurrencyCode,
    network: 'stellar',
    walletAddress: input.walletAddress,
    disableWalletAddressForm: true,
  };
  if (input.email) widgetParams.email = input.email;
  if (input.partnerUserId) widgetParams.partnerUserId = input.partnerUserId;

  const response = await fetch(`${baseUrl}/api/v2/auth/session`, {
    method: 'POST',
    headers: {
      'x-api-key': config.transak.apiKey,
      'x-user-ip': config.transak.userIpOverride || input.userIp,
      'access-token': accessToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ widgetParams }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => null) as any;
  if (!response.ok) {
    const detail = body?.message || body?.error?.message || `Transak returned ${response.status}`;
    throw new Error(detail);
  }
  const widgetUrl = body?.widgetUrl || body?.data?.widgetUrl;
  if (!widgetUrl || typeof widgetUrl !== 'string') throw new Error('Transak did not return a widget URL');
  return { widgetUrl, expiresInSeconds: 300 };
}
