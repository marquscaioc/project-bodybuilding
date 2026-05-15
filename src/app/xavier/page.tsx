import { ScorecardPage } from '@/components/ScorecardPage';
import { PasswordGate } from '@/components/PasswordGate';

export const metadata = { title: 'Xavier · Scorecard' };

export default function Page() {
  return (
    <PasswordGate>
      <ScorecardPage
        judgeId="xavier"
        themeClass="theme-xavier"
        brand="Xavier"
        brandLine1="Xavier"
        brandLine2="Scorecard"
        logoSrc="/logos/xavier.jpg"
      />
    </PasswordGate>
  );
}
