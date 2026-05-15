import { ScorecardPage } from '@/components/ScorecardPage';

export const metadata = { title: 'Xavier · Scorecard' };

export default function Page() {
  return (
    <ScorecardPage
      judgeId="xavier"
      themeClass="theme-xavier"
      brand="Xavier"
      brandLine1="Xavier"
      brandLine2="Scorecard"
      logoSrc="/logos/xavier.jpg"
    />
  );
}
