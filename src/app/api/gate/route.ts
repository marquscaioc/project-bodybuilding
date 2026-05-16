import { NextRequest, NextResponse } from 'next/server';
import {
  createGateToken,
  passwordMatches,
  GATE_COOKIE,
  GATE_COOKIE_MAX_AGE,
} from '@/lib/gate';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    /* fall through */
  }
  const password =
    body && typeof body === 'object' && 'password' in body
      ? (body as Record<string, unknown>).password
      : undefined;

  if (!passwordMatches(password)) {
    // small constant delay to blunt timing/brute-force loops
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await createGateToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GATE_COOKIE_MAX_AGE,
  });
  return res;
}
