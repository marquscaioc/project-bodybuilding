'use client';

import { useRef } from 'react';
import { Scorecard } from '@/components/Scorecard';
import { AthletePhotos } from '@/components/AthletePhotos';
import { ExportButton } from '@/components/ExportButton';
import { ResetButton } from '@/components/ResetButton';
import { ThemeNav } from '@/components/ThemeNav';
import { ScorecardStoreProvider, useScorecard } from '@/lib/store';

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
  /**
   * Optional node rendered *inside* this judge's store provider — use it for a
   * cloud-sync bridge (e.g. <JudgeCardSync/>) that must share the same store
   * the scorecard UI writes to.
   */
  sync?: React.ReactNode;
  /**
   * Show the judge/theme switcher. On a live desk the identity is fixed by
   * login, so it's hidden there; the solo playground keeps it on.
   */
  showThemeNav?: boolean;
  /**
   * Render the comparison-stage photos read-only. Judge desks mirror the
   * Host's curated images; the Host desk and solo routes stay editable.
   */
  photosReadOnly?: boolean;
  /** Only Dylan's primary Host desk can edit the shared athlete names. */
  athleteNamesReadOnly?: boolean;
};

export function ScorecardPage(props: ScorecardPageProps) {
  // Wrap the entire page in a per-judge store provider so every
  // useScorecard call descends through this judge's isolated store.
  return (
    <ScorecardStoreProvider judgeId={props.judgeId}>
      {props.sync}
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
  showThemeNav = true,
  photosReadOnly = false,
  athleteNamesReadOnly = false,
}: Omit<ScorecardPageProps, 'judgeId'>) {
  const cardRef = useRef<HTMLDivElement>(null);
  const scoredRows = useScorecard((state) =>
    state.rows.filter((row) => row.winner !== null).length,
  );

  return (
    <div className={`theme-wrap ${themeClass ?? ''}`} style={themeStyle}>
      <a className="skip-link" href="#scorecard-main">Skip to scorecard</a>
      <main id="scorecard-main" className="scorecard-shell">
        <header className="scorecard-command-bar">
          <div className="min-w-0">
            <span className="scorecard-kicker">
              <span className="bb-live-dot" aria-hidden /> Live judging desk
            </span>
            <h1 className="scorecard-brand truncate">{brand}</h1>
          </div>

          <div className="scorecard-status" aria-live="polite">
            <span className="scorecard-status-value">{String(scoredRows).padStart(2, '0')}</span>
            <span className="scorecard-status-label">of 12 calls locked</span>
          </div>

          <div className="scorecard-actions">
            <ResetButton />
            <ExportButton targetRef={cardRef} />
          </div>
        </header>

        {showThemeNav && (
          <div className="scorecard-network-nav">
            <ThemeNav />
          </div>
        )}

        <section className="scorecard-canvas" aria-label={`${brand} scorecard`}>
          <Scorecard
            ref={cardRef}
            brandLine1={brandLine1}
            brandLine2={brandLine2}
            logoSrc={logoSrc}
            logoAlt={brand}
            athleteNamesReadOnly={athleteNamesReadOnly}
          />
        </section>

        <section className="scorecard-photo-section" aria-label="Athlete comparison stage">
          <div className="scorecard-section-heading">
            <span>02 / Comparison stage</span>
            <span>Pose-synced athlete view</span>
          </div>
          <AthletePhotos readOnly={photosReadOnly} />
        </section>
      </main>
    </div>
  );
}
