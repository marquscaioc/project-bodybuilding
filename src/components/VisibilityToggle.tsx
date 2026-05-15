'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { getSupabaseBrowser } from '@/lib/supabase/client';

/**
 * Per-judge "show my scores to other judges" toggle.
 * Flips profiles.is_visible for the current user. Other judges'
 * `/live` page subscribes to the change in realtime.
 */
export function VisibilityToggle({ userId }: { userId: string }) {
  const [visible, setVisible] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = getSupabaseBrowser();
      const { data } = await sb
        .from('profiles')
        .select('is_visible')
        .eq('id', userId)
        .maybeSingle();
      if (!cancelled) setVisible(data?.is_visible ?? false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggle() {
    if (visible === null) return;
    const next = !visible;
    setBusy(true);
    setVisible(next); // optimistic
    const sb = getSupabaseBrowser();
    const { error } = await sb
      .from('profiles')
      .update({ is_visible: next })
      .eq('id', userId);
    if (error) {
      setVisible(!next); // revert
      console.warn('visibility toggle failed', error);
    }
    setBusy(false);
  }

  if (visible === null) {
    return (
      <span className="border border-[var(--rule)] px-3 py-1 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
        Loading…
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={
        visible
          ? 'Other judges can see your scores. Click to hide.'
          : 'Your scores are hidden from other judges. Click to reveal.'
      }
      className={clsx(
        'inline-flex items-center gap-2 border px-3 py-1 font-display text-[0.65rem] uppercase tracking-[0.25em] transition disabled:opacity-50',
        visible
          ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400 hover:text-black'
          : 'border-[var(--rule-strong)] bg-black/40 text-[var(--fg-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      <span
        aria-hidden
        className={clsx(
          'inline-block h-2 w-2 rounded-full',
          visible ? 'bg-emerald-300' : 'bg-[var(--fg-mute)]',
        )}
      />
      {visible ? 'Visible to judges' : 'Hidden from judges'}
    </button>
  );
}
