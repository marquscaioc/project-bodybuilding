'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LabCard } from '@/components/lab/LabCard';
import { ComparePanel } from '@/components/lab/ComparePanel';
import { ImportCardControl } from '@/components/lab/ImportCardControl';
import { PanelSim } from '@/components/lab/PanelSim';
import { MAX_DIFFERENTIAL_V2 } from '@/lib/scoringV2';
import { useLabCard } from '@/lib/storeV2';

/**
 * /lab — the testbed for the signed-margin algorithm (V2).
 *
 * Nothing here touches the live show. The lab keeps its own card under its own
 * localStorage key, reads V1 cards without writing to them, and reads
 * judge_cards without writing to it. Not linked from anywhere: you get here by
 * typing the URL.
 */
export default function LabPage() {
  // The lab store defers hydration so the server render and the first client
  // render agree; kick it off once we are actually in the browser.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    useLabCard.persist.rehydrate();
    setReady(true);
  }, []);

  return (
    <div className="theme-wrap theme-project-bodybuilding">
      <main className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col gap-8 px-4 py-8 sm:px-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bb-stamp text-[#ff2d8c]">Lab · experimental</span>
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
                Algorithm V2 · signed margin
              </span>
            </div>
            <Link
              href="/"
              className="border border-[var(--rule-strong)] px-3 py-1.5 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              ← Home
            </Link>
          </div>

          <h1 className="font-display text-4xl uppercase leading-none tracking-[0.08em] text-[var(--fg)] sm:text-6xl">
            Signed margin,
            <br />
            zero allowed
          </h1>

          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--fg-dim)]">
            One signed differential per row replaces winner + margin, so a judge
            can finally record &ldquo;dead even&rdquo; — on poses as well as
            categories. The denominator drops to{' '}
            <span className="text-[var(--fg)]">{MAX_DIFFERENTIAL_V2}</span>: win
            every row by the minimum margin and you score 100. The panel takes a
            trimmed mean and prints its own uncertainty.
          </p>

          <p className="max-w-[60ch] border-l-2 border-[var(--rule-strong)] pl-3 font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.18em] text-[var(--fg-mute)]">
            Read-only against the live show. Nothing on this page writes to a
            desk card or to Supabase.
          </p>
        </header>

        {!ready ? (
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--fg-mute)]">
            Loading card…
          </p>
        ) : (
          <>
            <ImportCardControl />
            <LabCard />
            <ComparePanel />
          </>
        )}

        <PanelSim />

        <footer className="pb-4 font-mono text-[0.55rem] uppercase leading-relaxed tracking-[0.2em] text-[var(--fg-mute)]">
          Deferred until 30+ historical cards exist: inverse-variance desk
          weights, judge-severity calibration, and recalibrating the denominator
          to 2.5σ of real differentials.
        </footer>
      </main>
    </div>
  );
}
