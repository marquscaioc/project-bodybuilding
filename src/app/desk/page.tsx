'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ScorecardPage } from '@/components/ScorecardPage';
import { JudgeCardSync } from '@/components/JudgeCardProvider';
import { getBuiltinJudge } from '@/lib/builtinJudges';
import { clearJudgeSession, getJudgeSession, HOST_SLUG } from '@/lib/show';

/**
 * The signed-in judge's live desk: their themed scorecard, cloud-synced to
 * judge_cards[slug] so the host console can reveal + average it. Reads the
 * desk from localStorage; if none, bounce to the pick-a-desk login.
 */
export default function DeskPage() {
  const router = useRouter();
  // undefined = still reading localStorage; null = no session (redirecting).
  const [slug, setSlug] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const s = getJudgeSession();
    if (!s) {
      router.replace('/login?next=/desk');
      return;
    }
    setSlug(s);
  }, [router]);

  if (!slug) return null;

  const judge = getBuiltinJudge(slug);
  if (!judge) return null;

  return (
    <>
      <ScorecardPage
        judgeId={`judge:${slug}`}
        themeClass={judge.themeClass}
        brand={judge.name}
        brandLine1={judge.line1}
        brandLine2={judge.line2}
        logoSrc={judge.logoSrc}
        showThemeNav={false}
        sync={<JudgeCardSync slug={slug} displayName={judge.name} />}
      />
      <DeskControls
        themeClass={judge.themeClass}
        judgeName={judge.name}
        isHost={slug === HOST_SLUG}
        onSwitch={() => {
          clearJudgeSession();
          router.replace('/login');
        }}
      />
    </>
  );
}

function DeskControls({
  themeClass,
  judgeName,
  isHost,
  onSwitch,
}: {
  themeClass: string;
  judgeName: string;
  isHost: boolean;
  onSwitch: () => void;
}) {
  return (
    <div
      className={`${themeClass} fixed bottom-3 right-3 z-40 flex items-center gap-2 border border-[var(--rule)] bg-black/85 px-3 py-2 backdrop-blur`}
    >
      <span className="font-display text-[0.6rem] uppercase tracking-[0.3em] text-[var(--fg-mute)]">
        Desk · {judgeName}
      </span>
      {isHost && (
        <Link
          href="/host"
          className="border border-[var(--accent)] bg-transparent px-3 py-1 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--strip-fg)]"
        >
          Host console
        </Link>
      )}
      <button
        type="button"
        onClick={onSwitch}
        className="border border-[var(--rule-strong)] bg-transparent px-3 py-1 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)] transition hover:text-[var(--fg)]"
      >
        Switch desk
      </button>
    </div>
  );
}
