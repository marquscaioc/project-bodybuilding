import { ScorecardPage } from '@/components/ScorecardPage';
import { PasswordGate } from '@/components/PasswordGate';

export const metadata = { title: 'Superchat · Scorecard' };

export default function Page() {
  return (
    <PasswordGate>
      <ScorecardPage
        judgeId="superchat"
        themeClass="theme-superchat"
        brand="Superchat"
        brandLine1="Superchat"
        brandLine2="Scorecard"
      />
    </PasswordGate>
  );
}
