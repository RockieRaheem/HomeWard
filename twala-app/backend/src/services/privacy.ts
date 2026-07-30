import { createHmac } from 'node:crypto';

const POLICY_VERSION = 'homeward-safety-v1';
const secret = process.env.AUTH_TOKEN_SECRET || 'homeward-demo-secret-not-for-production';

function normalize(value: string | undefined): string {
  return (value || '').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function hmac(value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function createRecipientCommitment(input: { userId: string; fullName: string; phone: string; network?: string }): string {
  return hmac(`recipient|v1|${input.userId}|${normalize(input.fullName)}|${normalize(input.phone)}|${normalize(input.network)}`);
}

export function createSafetyAudit(input: { commitment: string; amountUsdc: number; flags: string[]; confirmedAt: string }): string {
  return hmac(`safety|${POLICY_VERSION}|${input.commitment}|${input.amountUsdc.toFixed(7)}|${[...input.flags].sort().join(',')}|${input.confirmedAt}`);
}

export function memoForRecipientCommitment(commitment: string): string {
  // Stellar Memo.text permits 28 bytes. This reveals only a non-reversible HMAC prefix.
  return `HWV:${commitment.slice(0, 24)}`;
}

export { POLICY_VERSION };
