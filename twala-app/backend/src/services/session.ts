import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const secret = process.env.AUTH_TOKEN_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'homeward-development-session-secret');

function encode(value: string): string { return Buffer.from(value).toString('base64url'); }
function sign(value: string): string { return createHmac('sha256', secret).update(value).digest('base64url'); }

export function createSessionToken(userId: string): string {
  if (!secret) throw new Error('AUTH_TOKEN_SECRET must be configured in production');
  const payload = encode(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | null {
  if (!secret) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    return parsed.sub && parsed.exp && parsed.exp >= Math.floor(Date.now() / 1000) ? parsed.sub : null;
  } catch { return null; }
}
