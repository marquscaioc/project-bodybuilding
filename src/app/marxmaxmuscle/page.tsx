import { ScorecardPage } from '@/components/ScorecardPage';
import { PasswordGate } from '@/components/PasswordGate';

export const metadata = { title: 'Marx Max Muscle · Scorecard' };

export default function Page() {
  return (
    <PasswordGate>
      <ScorecardPage
        judgeId="marxmaxmuscle"
        themeClass="theme-marxmaxmuscle"
        brand="Marx Max Muscle"
        brandLine1="Marx Max"
        brandLine2="Muscle"
        logoSrc="/logos/marxmaxmuscle.jpg"
      />
    </PasswordGate>
  );
}
