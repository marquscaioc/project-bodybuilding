'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BUILTIN_JUDGES } from '@/lib/builtinJudges';
import {
  getJudgeSession,
  HOST_SLUG,
  isValidJudgeSlug,
  SHOW_CODE,
  setJudgeSession,
} from '@/lib/show';

/**
 * Pick-a-desk login for the live show. Tap your desk, type the shared show
 * code, and you're seated — your branding loads from the registry and your
 * scorecard cloud-syncs so the host can reveal it. Soft gate only.
 */
export default function LoginPage() {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') ?? '/desk';

  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Pre-select from the ?desk= link (roster tiles), else the last desk used.
  useEffect(() => {
    const fromLink = searchParams?.get('desk');
    if (isValidJudgeSlug(fromLink)) {
      setSelected(fromLink);
      return;
    }
    const existing = getJudgeSession();
    if (existing) setSelected(existing);
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Pick your desk first');
      return;
    }
    if (code.trim().toLowerCase() !== SHOW_CODE) {
      setError('Wrong show code');
      return;
    }
    setJudgeSession(selected);
    // Don't drop a non-host into the host console; send them to their desk.
    const target = next === '/host' && selected !== HOST_SLUG ? '/desk' : next;
    router.replace(target);
  }

  return (
    <main className="theme-wrap bb-stage relative flex min-h-dvh flex-col">
      <div aria-hidden className="bb-stage-floor" />
      <span className="bb-corner tl" />
      <span className="bb-corner tr" />
      <span className="bb-corner bl" />
      <span className="bb-corner br" />

      {/* Top broadcast bar */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 px-6 pt-6 sm:px-10">
        <div className="bb-reveal d1 flex items-center gap-3">
          <span className="bb-live-dot" />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-[#ff7aa8]">
            ON&nbsp;AIR &middot; Judge intake
          </span>
        </div>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[#d8a8e8]">
          Live Judging Network
        </span>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1100px] flex-1 flex-col justify-center px-6 py-10 sm:px-10">
        <div className="bb-reveal d2 mb-5 flex flex-wrap items-center gap-3">
          <span className="bb-ribbon">
            <span
              className="bb-live-dot"
              style={{ background: '#150318', boxShadow: 'none', animation: 'none' }}
            />
            Project Bodybuilding
          </span>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-[#d8a8e8]">
            Take your desk
          </span>
        </div>

        <h1 className="bb-reveal d3 font-display uppercase leading-[0.85] tracking-[0.02em] text-[#ffe3f3]">
          <span className="block text-[clamp(2.4rem,8vw,5rem)]">Pick your desk,</span>
          <span
            className="bb-mega-shadow block text-[clamp(2.4rem,8vw,5rem)]"
            style={{ color: '#ff2d8c' }}
          >
            score the show.
          </span>
        </h1>

        <p className="bb-reveal d4 mt-5 max-w-2xl text-[0.95rem] leading-relaxed text-[#e9c4dc]">
          Tap your desk, enter the show code, and you&apos;re live. You score
          your own card; the Project Bodybuilding host reveals everyone at the
          end and averages the panel.
        </p>

        {/* Desk picker */}
        <div className="bb-reveal d5 mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {BUILTIN_JUDGES.map((j) => {
            const active = selected === j.slug;
            return (
              <button
                key={j.slug}
                type="button"
                onClick={() => {
                  setSelected(j.slug);
                  if (error) setError(null);
                }}
                aria-pressed={active}
                className="bb-tile text-left"
                style={
                  {
                    '--mosaic-1': j.swatch,
                    '--mosaic-3': j.accent,
                    '--mosaic-5': j.deep,
                    borderColor: active ? j.swatch : undefined,
                    boxShadow: active
                      ? `0 0 0 2px ${j.swatch}, 0 8px 26px -12px ${j.swatch}`
                      : undefined,
                  } as React.CSSProperties
                }
              >
                <span className="bb-tile-tag">
                  {j.slug === HOST_SLUG ? 'Host' : active ? 'Selected' : ''}
                </span>
                {j.logoSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={j.logoSrc} alt="" className="bb-tile-avatar" />
                ) : (
                  <span
                    className="bb-tile-avatar flex items-center justify-center font-display text-lg text-[#0a0a0a]"
                    style={{ background: j.swatch }}
                  >
                    {j.name.charAt(0)}
                  </span>
                )}
                <span className="bb-tile-name">
                  <span className="bb-tile-name-1">{j.name}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Code + enter */}
        <form
          onSubmit={handleSubmit}
          className="bb-reveal d5 mt-8 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-2">
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.28em] text-[#d8a8e8]">
              Show code
            </span>
            <input
              type="text"
              autoComplete="off"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder="enter the shared code"
              className={`border bg-black/60 px-4 py-3 font-mono text-sm tracking-[0.2em] text-[#ffe3f3] caret-[#ff2d8c] outline-none transition placeholder:text-[var(--fg-mute)] ${
                error
                  ? 'border-[#ff1c4a] shadow-[0_0_0_3px_rgba(255,28,74,0.18)]'
                  : 'border-[var(--rule-strong)] focus:border-[#ff2d8c] focus:shadow-[0_0_0_3px_rgba(255,45,140,0.18)]'
              }`}
            />
          </label>
          <button
            type="submit"
            className="group inline-flex items-center justify-center gap-3 border border-[#ff2d8c] bg-[#ff2d8c] px-6 py-3 font-display text-base uppercase tracking-[0.22em] text-[#150318] transition hover:bg-transparent hover:text-[#ff2d8c]"
          >
            Take my seat <span className="text-xl">→</span>
          </button>
        </form>
        <span
          className="bb-reveal d5 mt-2 font-mono text-[0.58rem] uppercase tracking-[0.25em] transition"
          style={{ color: error ? '#ff1c4a' : 'var(--fg-mute)' }}
          aria-live="polite"
        >
          {error
            ? `× ${error}`
            : selected
              ? `Seating as ${BUILTIN_JUDGES.find((j) => j.slug === selected)?.name}`
              : 'Tap a desk above, then enter the show code'}
        </span>
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-auto border-t border-[var(--rule)] bg-black/40">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-6 py-5 sm:px-10">
          <span className="bb-live-dot" />
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-[#d8a8e8]">
            REC &middot; Project Bodybuilding Network
          </span>
        </div>
      </div>
    </main>
  );
}
