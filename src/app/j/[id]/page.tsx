'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ScorecardPage } from '@/components/ScorecardPage';
import {
  CUSTOM_JUDGES_EVENT,
  getCustomJudge,
  paletteToStyle,
} from '@/lib/customJudges';
import type { CustomJudgeConfig } from '@/types/customJudge';

export default function CustomJudgeRoute() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [config, setConfig] = useState<CustomJudgeConfig | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    function load() {
      setConfig(getCustomJudge(id!) ?? null);
    }
    load();
    window.addEventListener(CUSTOM_JUDGES_EVENT, load);
    return () => window.removeEventListener(CUSTOM_JUDGES_EVENT, load);
  }, [id]);

  if (config === undefined) {
    // Hydrating from localStorage — render nothing for one tick.
    return null;
  }
  if (config === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <span className="font-display text-3xl uppercase tracking-[0.3em]">
          Judge not found
        </span>
        <span className="text-sm uppercase tracking-[0.3em] text-white/50">
          This browser has no judge with id <code>{id}</code>
        </span>
        <Link
          href="/project-bodybuilding"
          className="border border-white/40 px-4 py-2 font-display text-xs uppercase tracking-[0.3em] hover:bg-white hover:text-black"
        >
          Back to scorecards
        </Link>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs uppercase tracking-[0.25em] text-white/40 hover:text-white"
        >
          ← Go back
        </button>
      </main>
    );
  }

  return (
    <ScorecardPage
      judgeId={config.id}
      themeStyle={paletteToStyle(config)}
      brand={config.name}
      brandLine1={config.brandLine1}
      brandLine2={config.brandLine2}
      logoSrc={config.logoDataUrl}
    />
  );
}
