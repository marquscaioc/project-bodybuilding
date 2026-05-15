import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/db';

/**
 * Server-side Supabase client (route handlers, server components).
 * Reads & writes auth cookies through the Next.js cookie API so the
 * session refreshes correctly across the request/response cycle.
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is a no-op when called from a Server Component;
            // middleware handles the actual cookie write.
          }
        },
      },
    },
  );
}
