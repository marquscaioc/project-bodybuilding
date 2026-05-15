'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (err) throw err;
      setStatus('sent');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }

  return (
    <main className="theme-wrap flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm border border-[var(--rule)] bg-black/60 p-6 backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="font-display text-3xl uppercase tracking-[0.3em] text-[var(--fg)]">
            Sign in
          </span>
          <span className="text-center text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
            Magic link · no password · we email you a one-time link
          </span>
        </div>

        {status === 'sent' ? (
          <div className="flex flex-col gap-3 text-center">
            <span className="font-display text-lg uppercase tracking-[0.2em] text-[var(--accent)]">
              Check your inbox
            </span>
            <span className="text-[0.7rem] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
              We sent a sign-in link to{' '}
              <span className="text-[var(--fg)]">{email}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setStatus('idle');
                setEmail('');
              }}
              className="mt-2 text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-mute)] hover:text-[var(--fg)]"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-display text-[0.65rem] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="border border-[var(--rule-strong)] bg-black/60 px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 font-display text-[0.7rem] uppercase tracking-[0.3em] text-[var(--strip-fg)] transition hover:opacity-90 disabled:opacity-40"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {error && (
              <div className="border border-red-500/60 bg-red-500/10 px-3 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-red-300">
                {error}
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
