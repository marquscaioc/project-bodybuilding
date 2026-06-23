import { ScorecardPage } from '@/components/ScorecardPage';
import { PasswordGate } from '@/components/PasswordGate';

export const metadata = { title: 'Supersetman · Scorecard' };

export default function Page() {
  return (
    <PasswordGate>
      <ScorecardPage
        judgeId="supersetman"
        themeClass="theme-supersetman"
        brand="Supersetman"
        brandLine1="Superset"
        brandLine2="man"
        logoSrc="/logos/supersetman.jpg"
      />
    </PasswordGate>
  );
}
