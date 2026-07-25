import config from '../config.js';
import type { TransferQuote, ExchangeRate } from '../types/index.js';

const LIVE_RATE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd';
const UGX_RATE_URL = 'https://open.er-api.com/v6/latest/USD';

let cachedRate: ExchangeRate | null = null;
let lastFetch = 0;

export async function getExchangeRate(): Promise<ExchangeRate> {
  const now = Date.now();
  if (cachedRate && now - lastFetch < 60000) return cachedRate;

  try {
    const res = await fetch(UGX_RATE_URL);
    const data = await res.json() as any;
    const usdToUgx = data.rates?.UGX || 3750;

    cachedRate = {
      usdcToUgx: usdToUgx,
      usdToUgx,
      lastUpdated: new Date().toISOString(),
      change24h: -0.3,
    };
    lastFetch = now;
  } catch {
    cachedRate = {
      usdcToUgx: 3750,
      usdToUgx: 3750,
      lastUpdated: new Date().toISOString(),
      change24h: 0,
    };
  }

  return cachedRate;
}

export function calculateQuote(amountUsdc: number, rate: ExchangeRate): TransferQuote {
  const feeUsdc = Math.max(amountUsdc * (config.homeward.feePercent / 100), config.homeward.feeFixedUsdc);
  const sendAmount = amountUsdc - feeUsdc;
  const receiveUgx = Math.round(sendAmount * rate.usdcToUgx);

  return {
    sendAmountUsdc: amountUsdc,
    receiveAmountUgx: receiveUgx,
    feeUsdc,
    feeUgx: Math.round(feeUsdc * rate.usdcToUgx),
    rate: rate.usdcToUgx,
    totalUsdc: amountUsdc,
    estimatedArrival: '1-2 minutes',
  };
}
