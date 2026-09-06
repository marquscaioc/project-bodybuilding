import 'server-only';

import { isValidJudgeSlug, HOST_SLUG } from '@/lib/show';

export const SHOW_COOKIE = 'bb_show';
export const SHOW_COOKIE_MAX_AGE = 12 * 60 * 60;

const CODE_ENV_BY_SLUG = {
  'project-bodybuilding': 'JUDGE_CODE_DYLAN',
  supersetman: 'JUDGE_CODE_SUPERSETMAN',
  epzeronine: 'JUDGE_CODE_EPZERONINE',
  marxmaxmuscle: 'JUDGE_CODE_MARXMAXMUSCLE',
  xavier: 'JUDGE_CODE_XAVIER',
  marcus: 'JUDGE_CODE_MARCUS',
} as const;

const DEVELOPMENT_CODES: Record<keyof typeof CODE_ENV_BY_SLUG, string> = {
  'project-bodybuilding': 'dylan123',
  supersetman: 'supersetman123',
  epzeronine: 'epzeronine123',
  marxmaxmuscle: 'marxmaxmuscle123',
  xavier: 'xavier123',
  marcus: 'marcus123',
};

function getSecret(): string {
  const secret = process.env.GATE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'local-development-only-secret';
  throw new Error('GATE_SECRET must be configured in production');
}

function getCode(slug: keyof typeof CODE_ENV_BY_SLUG): string {
  const configured = process.env[CODE_ENV_BY_SLUG[slug]];
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return DEVELOPMENT_CODES[slug];
  throw new Error(`${CODE_ENV_BY_SLUG[slug]} must be configured in production`);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function sign(payload: string): Promise<string> {
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
    new TextEncoder().encode(payload),
  );
  return Buffer.from(signature).toString('base64url');
}

export function resolveJudgeAccessCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 128) return null;
  const candidate = input.trim();

  for (const slug of Object.keys(CODE_ENV_BY_SLUG) as Array<keyof typeof CODE_ENV_BY_SLUG>) {
    if (constantTimeEqual(candidate, getCode(slug))) return slug;
  }
  return null;
}

export function allowedDesksFor(principal: string): string[] {
  if (!isValidJudgeSlug(principal)) return [];
  return principal === HOST_SLUG ? [HOST_SLUG, 'superchat'] : [principal];
}

export async function createShowToken(principal: string): Promise<string> {
  if (!isValidJudgeSlug(principal) || principal === 'superchat') {
    throw new Error('Invalid judge principal');
  }
  const expiresAt = Date.now() + SHOW_COOKIE_MAX_AGE * 1000;
  const payload = `${principal}.${expiresAt}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyShowToken(token: string | null | undefined) {
  if (!token) return null;
  const [principal, expiresAtRaw, signature, ...rest] = token.split('.');
  if (rest.length || !principal || !expiresAtRaw || !signature) return null;
  if (!isValidJudgeSlug(principal) || principal === 'superchat') return null;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const expected = await sign(`${principal}.${expiresAtRaw}`);
  return constantTimeEqual(expected, signature) ? principal : null;
}
