'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Stable shared password to view the legacy local scorecards
 * (the four built-in themes + any custom /j/[id] judge).
 *
 * NOT secure — the password is in the client bundle. This is a
 * simple gate to keep casual viewers out, not a security boundary.
 * Cloud-synced /me uses real Supabase auth instead.
 */
const PASSWORD = 'projectbb123';
const STORAGE_KEY = 'projectbb-unlocked';

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    setUnlocked(
      typeof window !== 'undefined' &&
        window.localStorage.getItem(STORAGE_KEY) === 'true',
    );
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSWORD) {
      window.localStorage.setItem(STORAGE_KEY, 'true');
      setUnlocked(true);
    } else {
      setError(true);
    }
  }

  if (unlocked === null) return null; // hydrating, avoid flash
  if (unlocked) return <>{children}</>;

  return (
    <main className="theme-wrap flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm border border-[var(--rule)] bg-black/60 p-6 backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="font-display text-2xl uppercase tracking-[0.3em] text-[var(--fg)]">
            Locked
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
            Enter the shared password to access this scorecard
          </span>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(false);
            }}
            placeholder="Password"
            className="border border-[var(--rule-strong)] bg-black/60 px-3 py-2 text-base text-[var(--fg)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 font-display text-[0.7rem] uppercase tracking-[0.3em] text-[var(--strip-fg)] hover:opacity-90"
          >
            Unlock
          </button>
          {error && (
            <div className="border border-red-500/60 bg-red-500/10 px-3 py-2 text-center text-[0.65rem] uppercase tracking-[0.2em] text-red-300">
              Wrong password
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
