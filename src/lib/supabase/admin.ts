import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/db';

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // New Supabase projects expose an sb_secret_* key; older projects use the
  // service-role JWT. Both are server-only and bypass RLS for these routes.
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const developmentKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const key = serviceRoleKey || (
    process.env.NODE_ENV !== 'production' ? developmentKey : undefined
  );

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be configured',
    );
  }

  adminClient = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return adminClient;
}
