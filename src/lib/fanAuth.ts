import 'server-only';

export const FAN_COOKIE = 'bb_fan';
export const CLAIM_COOKIE = 'bb_claim';
export const VOTER_COOKIE = 'bb_voter';
export const FAN_SESSION_MAX_AGE = 12 * 60 * 60;
export const CLAIM_SESSION_MAX_AGE = 2 * 60 * 60;
export const VOTER_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSecret(): string {
  const secret = process.env.GATE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'local-development-only-secret';
  throw new Error('GATE_SECRET must be configured in production');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function sign(namespace: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${namespace}.${payload}`),
  );
  return Buffer.from(signature).toString('base64url');
}

async function createToken(namespace: string, subject: string, maxAge: number) {
  if (!UUID_PATTERN.test(subject)) throw new Error('Invalid session subject');
  const expiresAt = Date.now() + maxAge * 1000;
  const payload = `${subject}.${expiresAt}`;
  return `${payload}.${await sign(namespace, payload)}`;
}

async function verifyToken(
  namespace: string,
  token: string | null | undefined,
): Promise<string | null> {
  if (!token || token.length > 256) return null;
  const [subject, expiresAtRaw, signature, ...rest] = token.split('.');
  if (rest.length || !subject || !expiresAtRaw || !signature || !UUID_PATTERN.test(subject)) {
    return null;
  }
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const expected = await sign(namespace, `${subject}.${expiresAtRaw}`);
  return constantTimeEqual(expected, signature) ? subject : null;
}

export function createFanToken(cardId: string) {
  return createToken('fan', cardId, FAN_SESSION_MAX_AGE);
}

export function verifyFanToken(token: string | null | undefined) {
  return verifyToken('fan', token);
}

export function createClaimToken(claimId: string) {
  return createToken('claim', claimId, CLAIM_SESSION_MAX_AGE);
}

export function verifyClaimToken(token: string | null | undefined) {
  return verifyToken('claim', token);
}

export function createVoterToken(voterId: string) {
  return createToken('voter', voterId, VOTER_SESSION_MAX_AGE);
}

export function verifyVoterToken(token: string | null | undefined) {
  return verifyToken('voter', token);
}

export const secureCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});

/** Request-time expiration check kept server-side so React render code stays deterministic. */
export function hasExpired(isoTimestamp: string) {
  return new Date(isoTimestamp).getTime() <= Date.now();
}
