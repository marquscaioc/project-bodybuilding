import { notFound } from 'next/navigation';
import { ScorecardPage } from '@/components/ScorecardPage';
import { getBuiltinJudge } from '@/lib/builtinJudges';

export function BuiltinScorecardPage({ slug }: { slug: string }) {
  const judge = getBuiltinJudge(slug);
  if (!judge) notFound();

  return (
    <ScorecardPage
      judgeId={judge.slug}
      themeClass={judge.themeClass}
      brand={judge.name}
      brandLine1={judge.line1}
      brandLine2={judge.line2}
      logoSrc={judge.logoSrc}
    />
  );
}
