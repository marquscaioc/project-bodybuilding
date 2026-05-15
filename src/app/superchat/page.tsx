import { ScorecardPage } from '@/components/ScorecardPage';

export const metadata = { title: 'Superchat · Scorecard' };

export default function Page() {
  return (
    <ScorecardPage
      judgeId="superchat"
      themeClass="theme-superchat"
      brand="Superchat"
      brandLine1="Superchat"
      brandLine2="Scorecard"
    />
  );
}
