'use client';

import { useRef } from 'react';
import { Scorecard } from '@/components/Scorecard';
import { AthletePhotos } from '@/components/AthletePhotos';
import { ExportButton } from '@/components/ExportButton';
import { ResetButton } from '@/components/ResetButton';
import { ThemeNav } from '@/components/ThemeNav';
import { ScorecardStoreProvider } from '@/lib/store';

export type ScorecardPageProps = {
  /**
   * Stable identifier for this judge — used as the Zustand store key and
   * the localStorage namespace. Each unique judgeId gets its own
   * isolated scoring state, photos, names, and pose tabs.
   */
  judgeId: string;
  /** CSS class for built-in themes. Optional when using inline themeStyle. */
  themeClass?: string;
  /** Inline CSS variable overrides (used by custom judges). */
  themeStyle?: React.CSSProperties;
  brand: string;
  brandLine1: string;
  brandLine2: string;
  logoSrc?: string;
};

export function ScorecardPage(props: ScorecardPageProps) {
  // Wrap the entire page in a per-judge store provider so every
  // useScorecard call descends through this judge's isolated store.
  return (
    <ScorecardStoreProvider judgeId={props.judgeId}>
      <ScorecardPageBody {...props} />
    </ScorecardStoreProvider>
  );
}

function ScorecardPageBody({
  themeClass,
  themeStyle,
  brand,
  brandLine1,
  brandLine2,
  logoSrc,
}: Omit<ScorecardPageProps, 'judgeId'>) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`theme-wrap ${themeClass ?? ''}`} style={themeStyle}>
      <main className="flex min-h-dvh flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        <header className="flex flex-wrap items-center justify-center gap-3 text-center">
          <span className="text-[0.7rem] uppercase tracking-[0.35em] text-[var(--fg-dim)]">
            {brand} · Live
          </span>
          <ThemeNav />
          <div className="flex items-center gap-2">
            <ResetButton />
            <ExportButton targetRef={cardRef} />
          </div>
        </header>

        <Scorecard
          ref={cardRef}
          brandLine1={brandLine1}
          brandLine2={brandLine2}
          logoSrc={logoSrc}
          logoAlt={brand}
        />

        <AthletePhotos />
      </main>
    </div>
  );
}
