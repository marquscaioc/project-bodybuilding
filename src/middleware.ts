import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refresh Supabase auth tokens on every request that could need them.
 * Wrapped in try/catch so a missing / wrong env var (or transient
 * Supabase outage) never 500s the entire site — middleware just no-ops
 * and the request continues to the page handler.
 */
export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // No Supabase configured → skip entirely (e.g. preview builds).
  if (!url || !key) return NextResponse.next({ request: req });

  let res = NextResponse.next({ request: req });
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    });
    await supabase.auth.getUser();
  } catch (err) {
    // Don't crash the request just because session refresh failed.
    console.warn('middleware auth refresh failed', err);
  }
  return res;
}

export const config = {
  matcher: [
    // Run on every route except static assets, image optimization, and favicons.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|gif|ico|woff2?)$).*)',
  ],
};
