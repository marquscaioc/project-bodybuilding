import { ScorecardPage } from '@/components/ScorecardPage';

export const metadata = { title: 'Marcus · Scorecard' };

export default function Page() {
  return (
    <ScorecardPage
      judgeId="marcus"
      themeClass="theme-marcus"
      brand="Marcus"
      brandLine1="Marcus"
      brandLine2="Scorecard"
      logoSrc="/logos/muscle.jpg"
    />
  );
}
