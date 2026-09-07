import { notFound } from 'next/navigation';
import { JudgeCardSync } from '@/components/JudgeCardProvider';
import { ScorecardPage } from '@/components/ScorecardPage';
import { ShowPhotosSync } from '@/components/ShowPhotosSync';
import { getBuiltinJudge } from '@/lib/builtinJudges';
import { HOST_SLUG, SHOW_ID } from '@/lib/show';

export function BuiltinScorecardPage({ slug }: { slug: string }) {
  const judge = getBuiltinJudge(slug);
  if (!judge) notFound();
  const isHost = slug === HOST_SLUG;

  return (
    <ScorecardPage
      judgeId={judge.slug}
      themeClass={judge.themeClass}
      brand={judge.name}
      brandLine1={judge.line1}
      brandLine2={judge.line2}
      logoSrc={judge.logoSrc}
      photosReadOnly={!isHost}
      athleteNamesReadOnly={!isHost}
      sync={
        <>
          <JudgeCardSync slug={slug} displayName={judge.name} />
          <ShowPhotosSync showCode={SHOW_ID} isHost={isHost} />
        </>
      }
    />
  );
}
