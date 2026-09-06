'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScorecardPage } from '@/components/ScorecardPage';
import { JudgeCardSync } from '@/components/JudgeCardProvider';
import { ShowPhotosSync } from '@/components/ShowPhotosSync';
import { getBuiltinJudge } from '@/lib/builtinJudges';
import {
  clearJudgeSession,
  getJudgeSession,
  HOST_SLUG,
  setJudgeSession,
  SHOW_ID,
} from '@/lib/show';

type DeskSession = {
  principal: string;
  allowedDesks: string[];
};

export default function DeskPage() {
  const router = useRouter();
  const [session, setSession] = useState<DeskSession | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const response = await fetch('/api/show-session', { cache: 'no-store' });
      if (!response.ok) {
        clearJudgeSession();
        router.replace('/?access=required');
        return;
      }

      const data = await response.json() as DeskSession;
      if (cancelled) return;
      const preferred = getJudgeSession();
      const active = preferred && data.allowedDesks.includes(preferred)
        ? preferred
        : data.principal;
      setJudgeSession(active);
      setSession(data);
      setSlug(active);
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!session || !slug) return null;

  const judge = getBuiltinJudge(slug);
  if (!judge) return null;

  const isPrincipalHost = session.principal === HOST_SLUG;
  const isPrimaryHostDesk = isPrincipalHost && slug === HOST_SLUG;

  async function signOut() {
    await fetch('/api/show-session', { method: 'DELETE' }).catch(() => undefined);
    clearJudgeSession();
    router.replace('/');
  }

  function selectDesk(nextSlug: string) {
    if (!session?.allowedDesks.includes(nextSlug)) return;
    setJudgeSession(nextSlug);
    setSlug(nextSlug);
  }

  return (
    <>
      <ScorecardPage
        key={slug}
        judgeId={`judge:${slug}`}
        themeClass={judge.themeClass}
        brand={judge.name}
        brandLine1={judge.line1}
        brandLine2={judge.line2}
        logoSrc={judge.logoSrc}
        showThemeNav={false}
        photosReadOnly={!isPrimaryHostDesk}
        sync={
          <>
            <JudgeCardSync slug={slug} displayName={judge.name} />
            <ShowPhotosSync showCode={SHOW_ID} isHost={isPrimaryHostDesk} />
          </>
        }
      />
      <DeskControls
        themeClass={judge.themeClass}
        activeSlug={slug}
        allowedDesks={session.allowedDesks}
        canOpenHost={isPrincipalHost}
        onSelectDesk={selectDesk}
        onSignOut={signOut}
      />
    </>
  );
}

function DeskControls({
  themeClass,
  activeSlug,
  allowedDesks,
  canOpenHost,
  onSelectDesk,
  onSignOut,
}: {
  themeClass: string;
  activeSlug: string;
  allowedDesks: string[];
  canOpenHost: boolean;
  onSelectDesk: (slug: string) => void;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <div
      className={`${themeClass} fixed bottom-3 right-3 z-40 flex flex-wrap items-center justify-end gap-2 border border-[var(--rule)] bg-black/90 px-3 py-2 backdrop-blur`}
    >
      {allowedDesks.length > 1 && (
        <div className="flex items-center gap-1" aria-label="Authorized desks">
          {allowedDesks.map((slug) => {
            const judge = getBuiltinJudge(slug);
            if (!judge) return null;
            const active = slug === activeSlug;
            return (
              <button
                key={slug}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectDesk(slug)}
                className="min-h-9 border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition"
                style={{
                  borderColor: active ? judge.accent : 'var(--rule-strong)',
                  color: active ? judge.accent : 'var(--fg-dim)',
                }}
              >
                {judge.name}
              </button>
            );
          })}
        </div>
      )}
      {canOpenHost && (
        <Link
          href="/host"
          className="inline-flex min-h-9 items-center border border-[var(--accent)] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--bg)]"
        >
          Host console
        </Link>
      )}
      <button
        type="button"
        onClick={onSignOut}
        className="min-h-9 border border-[var(--rule-strong)] bg-transparent px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--fg-dim)] transition hover:text-[var(--fg)]"
      >
        Sign out
      </button>
    </div>
  );
}
