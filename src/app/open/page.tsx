import { ScorecardPage } from '@/components/ScorecardPage';

export const metadata = { title: 'Open Scorecard · Project Bodybuilding' };

/**
 * Public, passwordless scorecard. Anyone with the link can use it.
 * Data is still isolated to the visitor's own browser (judgeId 'open'
 * → localStorage namespace), so multiple people on the same link see
 * different scores. To share scores in realtime use /me + /live.
 */
export default function Page() {
  return (
    <ScorecardPage
      judgeId="open"
      themeClass="theme-project-bodybuilding"
      brand="Open Scorecard"
      brandLine1="Open"
      brandLine2="Scorecard"
    />
  );
}
