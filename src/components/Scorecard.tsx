'use client';

import { forwardRef } from 'react';
import { useScorecard } from '@/lib/store';
import { ScoreTable } from './ScoreTable';
import { FinalScore } from './FinalScore';
import { TitleBlock } from './TitleBlock';

type Props = {
  brandLine1?: string;
  brandLine2?: string;
  logoSrc?: string;
  logoAlt?: string;
};

export const Scorecard = forwardRef<HTMLDivElement, Props>(function Scorecard(
  { brandLine1, brandLine2, logoSrc, logoAlt },
  ref,
) {
  const rows = useScorecard((s) => s.rows);
  const poses = rows.filter((r) => r.type === 'pose');
  const categories = rows.filter((r) => r.type === 'category');

  return (
    <div ref={ref} className="grain grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
      <TitleBlock line1={brandLine1} line2={brandLine2} logoSrc={logoSrc} logoAlt={logoAlt} />

      <div className="lg:col-span-1">
        <ScoreTable title="Poses" rows={poses} />
      </div>

      <div className="flex flex-col gap-5 lg:col-span-1">
        <ScoreTable title="Categories" rows={categories} />
        <FinalScore />
      </div>
    </div>
  );
});
