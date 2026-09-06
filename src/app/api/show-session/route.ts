import { NextRequest, NextResponse } from 'next/server';
import {
  allowedDesksFor,
  createShowToken,
  resolveJudgeAccessCode,
  SHOW_COOKIE,
  SHOW_COOKIE_MAX_AGE,
  verifyShowToken,
} from '@/lib/showAuth';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const principal = await verifyShowToken(request.cookies.get(SHOW_COOKIE)?.value);
  if (!principal) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  return NextResponse.json(
    { ok: true, principal, allowedDesks: allowedDesksFor(principal) },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE });
  }

  const code =
    body && typeof body === 'object' && 'code' in body
      ? (body as Record<string, unknown>).code
      : undefined;
  const principal = resolveJudgeAccessCode(code);

  if (!principal) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  const response = NextResponse.json(
    { ok: true, principal, allowedDesks: allowedDesksFor(principal) },
    { headers: NO_STORE },
  );
  response.cookies.set(SHOW_COOKIE, await createShowToken(principal), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SHOW_COOKIE_MAX_AGE,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(SHOW_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
