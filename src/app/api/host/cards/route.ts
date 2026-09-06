import { NextRequest, NextResponse } from 'next/server';
import { HOST_SLUG } from '@/lib/show';
import { SHOW_COOKIE, verifyShowToken } from '@/lib/showAuth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const principal = await verifyShowToken(request.cookies.get(SHOW_COOKIE)?.value);
  if (principal !== HOST_SLUG) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('judge_cards')
    .select('*');
  if (error) {
    return NextResponse.json({ error: 'Could not load panel' }, { status: 502, headers: NO_STORE });
  }
  return NextResponse.json({ cards: data }, { headers: NO_STORE });
}
