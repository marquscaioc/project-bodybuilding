'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';

/**
 * Username-only sign-up. Uses Supabase anonymous auth — no email,
 * no password, no magic link. The username becomes the judge's
 * display name on their profile and shows up in /live.
 *
 * The session persists in localStorage as long as the browser holds
 * the cookie; signing out creates a fresh anonymous user next time.
 */
export default function LoginPage() {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') ?? '/me';

  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // If the user is already signed in, jump straight to /me.
  useEffect(() => {
    (async () => {
      const sb = getSupabaseBrowser();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user) router.replace(next);
    })();
  }, [router, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Pick a username');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setError(null);

    const sb = getSupabaseBrowser();
    try {
      // 1) Create an anonymous auth user.
      const { data, error: signErr } = await sb.auth.signInAnonymously();
      if (signErr || !data.user) {
        throw signErr ?? new Error('Sign-in failed');
      }
      // 2) Save the chosen username as display_name on the auto-created profile.
      const { error: updErr } = await sb
        .from('profiles')
        .update({ display_name: trimmed, brand_line_1: trimmed })
        .eq('id', data.user.id);
      if (updErr) throw updErr;
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }

  return (
    <main className="theme-wrap flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm border border-[var(--rule)] bg-black/60 p-6 backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="font-display text-3xl uppercase tracking-[0.3em] text-[var(--fg)]">
            Pick a username
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
            That&apos;s it · no email · no password
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-display text-[0.65rem] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
              Username
            </span>
            <input
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={32}
              placeholder="e.g., marqus"
              className="border border-[var(--rule-strong)] bg-black/60 px-3 py-2 text-base text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 font-display text-[0.7rem] uppercase tracking-[0.3em] text-[var(--strip-fg)] transition hover:opacity-90 disabled:opacity-40"
          >
            {status === 'submitting' ? 'Signing in…' : 'Continue'}
          </button>
          {error && (
            <div className="border border-red-500/60 bg-red-500/10 px-3 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-red-300">
              {error}
            </div>
          )}
          <p className="mt-2 text-center text-[0.55rem] uppercase tracking-[0.2em] text-[var(--fg-mute)]">
            Your scorecard is saved to this browser. Sign out and your data is
            gone.
          </p>
        </form>
      </div>
    </main>
  );
}
