'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/db';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Singleton browser-side Supabase client. Uses the project's publishable
 * key — safe to expose, all access is gated by RLS policies.
 */
export function getSupabaseBrowser() {
  if (client) return client;
  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  return client;
}
