import config from '../config.js';

export interface CreateTransakCheckoutInput {
  fiatAmount: number;
  walletAddress: string;
  email?: string;
  partnerUserId?: string;
}

export function getTransakStatus() {
  const configured = Boolean(
    config.transak.apiKey && config.transak.accessToken && config.transak.referrerDomain
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

/** Creates a single-use Transak widget URL. The partner access token remains server-side. */
export async function createCheckout(input: CreateTransakCheckoutInput): Promise<{ widgetUrl: string; expiresInSeconds: number }> {
  const status = getTransakStatus();
  if (!status.configured) {
    throw new Error('Transak is not configured. Set TRANSAK_API_KEY, TRANSAK_ACCESS_TOKEN and TRANSAK_REFERRER_DOMAIN on the backend.');
  }
  if (!Number.isFinite(input.fiatAmount) || input.fiatAmount <= 0) throw new Error('A valid fiat amount is required');
  if (!/^G[A-Z2-7]{55}$/.test(input.walletAddress)) throw new Error('A valid Stellar wallet address is required');

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
    headers: { 'access-token': config.transak.accessToken, 'content-type': 'application/json' },
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
