import { ScorecardPage } from '@/components/ScorecardPage';
import { PasswordGate } from '@/components/PasswordGate';

export const metadata = { title: 'EPzeronine · Scorecard' };

export default function Page() {
  return (
    <PasswordGate>
      <ScorecardPage
        judgeId="epzeronine"
        themeClass="theme-epzeronine"
        brand="EPzeronine"
        brandLine1="EP"
        brandLine2="zeronine"
        logoSrc="/logos/epzeronine.jpg"
      />
    </PasswordGate>
  );
}
