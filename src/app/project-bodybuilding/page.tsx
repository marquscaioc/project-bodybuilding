import { ScorecardPage } from '@/components/ScorecardPage';
import { PasswordGate } from '@/components/PasswordGate';

export const metadata = { title: 'Project: Bodybuilding · Scorecard' };

export default function Page() {
  return (
    <PasswordGate>
      <ScorecardPage
        judgeId="project-bodybuilding"
        themeClass="theme-project-bodybuilding"
        brand="Project: Bodybuilding"
        brandLine1="Project:"
        brandLine2="Bodybuilding"
        logoSrc="/logos/dih.jpg"
      />
    </PasswordGate>
  );
}
