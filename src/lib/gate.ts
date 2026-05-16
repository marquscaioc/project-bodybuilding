/**
 * Single-password gate for the public scorecard.
 *
 * Cookie value format: `<expiresAtMs>.<hmacSha256(SECRET, expiresAtMs)>`
 * Both signing and verifying use Web Crypto so the helpers work in
 * Edge middleware and Node route handlers.
 *
 * Set `GATE_PASSWORD` and `GATE_SECRET` in Railway for production.
 */

const PASSWORD = process.env.GATE_PASSWORD || 'projectbb123';
const SECRET =
  process.env.GATE_SECRET ||
  'pbb-default-rotate-in-railway-env-vars-please-3f8a';

export const GATE_COOKIE = 'bb_gate';
const TTL_SECONDS = 7 * 24 * 60 * 60;

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(sig);
}

export async function createGateToken(): Promise<string> {
  const exp = Date.now() + TTL_SECONDS * 1000;
  const payload = String(exp);
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifyGateToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await sign(payload);
  if (!timingSafeEqual(expected, sig)) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return true;
}

export function passwordMatches(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  return input.trim().toLowerCase() === PASSWORD.toLowerCase();
}

export const GATE_COOKIE_MAX_AGE = TTL_SECONDS;
