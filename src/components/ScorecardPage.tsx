'use client';

import { useRef } from 'react';
import { Scorecard } from '@/components/Scorecard';
import { AthletePhotos } from '@/components/AthletePhotos';
import { ExportButton } from '@/components/ExportButton';
import { ResetButton } from '@/components/ResetButton';
import { ThemeNav } from '@/components/ThemeNav';

export type ScorecardPageProps = {
  themeClass: string;
  brand: string;
  brandLine1: string;
  brandLine2: string;
  logoSrc?: string;
};

export function ScorecardPage({
  themeClass,
  brand,
  brandLine1,
  brandLine2,
  logoSrc,
}: ScorecardPageProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`theme-wrap ${themeClass}`}>
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
