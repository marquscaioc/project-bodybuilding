import { ScorecardPage } from '@/components/ScorecardPage';

export const metadata = { title: 'Project: Bodybuilding · Scorecard' };

export default function Page() {
  return (
    <ScorecardPage
      themeClass="theme-project-bodybuilding"
      brand="Project: Bodybuilding"
      brandLine1="Project:"
      brandLine2="Bodybuilding"
      logoSrc="/logos/dih.jpg"
    />
  );
}
