export interface WalletInfo {
  publicKey: string;
  secretKey: string;
  balanceUsdc: number;
  balanceXlm: number;
  isFunded: boolean;
}

export interface Transaction {
  id: string;
  type: 'sent' | 'received';
  amountUsdc: number;
  amountUgx?: number;
  rate?: number;
  recipientName: string;
  recipientPhone?: string;
  recipientNetwork?: 'MTN' | 'AIRTEL';
  status: 'pending' | 'completed' | 'failed';
  purpose: string;
  stellarTxHash?: string;
  stellarOperationId?: string;
  kotaniReferenceId?: string;
  kotaniStatus?: string;
  goalId?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  targetAmountUgx: number;
  savedAmountUgx: number;
  targetDate: string;
  category: string;
  milestones: Milestone[];
  status: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  targetAmountUgx: number;
  description: string;
  completed: boolean;
  completedAt?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sessionId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: 'payment' | 'goal' | 'tip';
  readAt?: string;
  createdAt: string;
}

export interface ExchangeRate {
  usdcToUgx: number;
  usdToUgx: number;
  lastUpdated: string;
  change24h: number;
}

export interface TransferQuote {
  sendAmountUsdc: number;
  receiveAmountUgx: number;
  feeUsdc: number;
  feeUgx: number;
  rate: number;
  totalUsdc: number;
  estimatedArrival: string;
}

// ---------------------------------------------------------------------------
// User Profile
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  pinHash: string;
  createdAt: string;
}

export interface AiContext {
  walletBalance: number;
  goals: Goal[];
  recentTransactions: Transaction[];
  activeGoal?: Goal;
  userName: string;
  userPhone?: string;
}

// ---------------------------------------------------------------------------
// Stellar-specific types
// ---------------------------------------------------------------------------

export interface StellarPayment {
  id: string;
  pagingToken: string;
  transactionHash: string;
  operationId: string;
  type: 'payment' | 'create_account';
  assetType: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  assetCode?: string;
  assetIssuer?: string;
  from: string;
  to: string;
  amount: string;
  memo?: string;
  memoType?: string;
  createdAt: string;
  isReceived: boolean;
}

export interface StellarTrustline {
  assetCode: string;
  assetIssuer: string;
  balance: string;
  limit: string;
  isAuthorized: boolean;
}

export interface StellarAccountInfo {
  publicKey: string;
  sequence: string;
  subentryCount: number;
  balances: Array<{
    assetType: string;
    assetCode?: string;
    assetIssuer?: string;
    balance: string;
    limit?: string;
    buyingLiabilities?: string;
    sellingLiabilities?: string;
  }>;
  signers: Array<{
    key: string;
    weight: number;
    type: string;
  }>;
  thresholds: {
    lowThreshold: number;
    medThreshold: number;
    highThreshold: number;
  };
  isFunded: boolean;
  xlmReserve: number;
  availableXlm: number;
}

export interface StellarFeeStats {
  lastLedger: number;
  lastLedgerBaseFee: number;
  modeAcceptedFee: number;
  minAcceptedFee: number;
  maxFee: number;
  feeCharged: {
    max: number;
    min: number;
    mode: number;
    p10: number;
    p20: number;
    p30: number;
    p40: number;
    p50: number;
    p60: number;
    p70: number;
    p80: number;
    p90: number;
    p95: number;
    p99: number;
  };
  ledgerCapacityUsage: number;
  recommendedFee: number;
}
