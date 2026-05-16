'use client';

import { useEffect, useState, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const PANEL_FACES = ['/logos/dih.jpg', '/logos/xavier.jpg', '/logos/muscle.jpg'];
const GATE_PASSWORD = 'projectbb123';

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [clock, setClock] = useState<string>('--:--:--');
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function tick() {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setClock(
        `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`,
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (password.trim().toLowerCase() === GATE_PASSWORD) {
      setError(false);
      setUnlocking(true);
      setTimeout(() => router.push('/open'), 600);
    } else {
      setError(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }

  return (
    <main className="theme-wrap min-h-dvh">
      {/* ═══════════ HERO — broadcast stage ═══════════ */}
      <section className="bb-stage relative min-h-dvh">
        <div aria-hidden className="bb-stage-floor" />
        <span className="bb-corner tl" />
        <span className="bb-corner tr" />
        <span className="bb-corner bl" />
        <span className="bb-corner br" />

        {/* Top broadcast bar */}
        <div className="relative z-10 mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 pt-6 sm:px-10">
          <div className="bb-reveal d1 flex items-center gap-3">
            <span className="bb-live-dot" />
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-[#ff7aa8]">
              ON&nbsp;AIR &middot; Live Judging Network
            </span>
          </div>
          <div className="bb-reveal d1 flex items-center gap-3">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[#d8a8e8]">
              Broadcast&nbsp;//&nbsp;Single Channel
            </span>
            <span className="bb-clock" suppressHydrationWarning>
              <span className="bb-live-dot" style={{ width: 6, height: 6 }} />
              {mounted ? clock : '--:--:-- UTC'}
            </span>
          </div>
        </div>

        {/* Mega type */}
        <div className="relative z-10 mx-auto max-w-[1400px] px-6 pb-14 pt-12 sm:px-10 sm:pb-24 sm:pt-20">
          <div className="bb-reveal d2 mb-6 flex flex-wrap items-center gap-3">
            <span className="bb-ribbon">
              <span
                className="bb-live-dot"
                style={{ background: '#150318', boxShadow: 'none', animation: 'none' }}
              />
              Project Bodybuilding
            </span>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-[#d8a8e8]">
              Vol. 01 / Scorecard Edition
            </span>
          </div>

          <h1 className="bb-mega bb-reveal d3 text-[#ffe3f3]">
            <span className="block">Pose,</span>
            <span className="bb-mega-shadow block" style={{ color: '#ff2d8c' }}>
              Compare,
            </span>
            <span className="bb-mega-outline block">Crown.</span>
          </h1>

          <div className="mt-10 grid gap-8 sm:grid-cols-[1.4fr_1fr] sm:items-end">
            <p className="bb-reveal d4 max-w-2xl text-[0.95rem] leading-relaxed text-[#e9c4dc] sm:text-base">
              Pairwise margin scoring for one-versus-one bodybuilding match-ups.
              One scorecard, one mission &mdash; enter the access code to step
              onto the floor.
            </p>

            <div className="bb-reveal d5 flex flex-col gap-3 sm:items-end">
              <div className="bb-panel-row">
                {PANEL_FACES.map((src) => (
                  <span
                    key={src}
                    className="bb-panel-face"
                    style={{ backgroundImage: `url(${src})` }}
                  />
                ))}
              </div>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.28em] text-[#d8a8e8]">
                Panel of judges &middot; standing by
              </span>
            </div>
          </div>

          {/* ═══════════ GATE — single feature card with password ═══════════ */}
          <div className="bb-reveal d5 mt-14">
            <div className="bb-feature theme-project-bodybuilding relative flex flex-col gap-7 p-7 sm:p-10">
              <div className="flex items-center justify-between gap-4">
                <span className="bb-stamp text-[#ff2d8c]">
                  <span
                    className="bb-live-dot"
                    style={{ background: '#ff2d8c', width: 6, height: 6 }}
                  />
                  Access / Secured
                </span>
                <span className="font-mono text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
                  Gate&nbsp;01
                </span>
              </div>

              <div className="grid gap-8 sm:grid-cols-[1.3fr_1fr] sm:items-end">
                <div>
                  <h2 className="font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-none tracking-[0.04em] text-[#ffe3f3]">
                    Open <span className="text-[#ff2d8c]">Scorecard</span>
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-[#d8a8e8]">
                    Pairwise judging &middot; half-step margins &middot; data
                    isolated to your browser. Type the access code below to
                    enter the card.
                  </p>
                </div>

                <form onSubmit={submit} className="flex flex-col gap-3">
                  <label className="font-mono text-[0.58rem] uppercase tracking-[0.28em] text-[#d8a8e8]">
                    Access Code
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      ref={inputRef}
                      type="password"
                      autoComplete="off"
                      autoFocus
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(false);
                      }}
                      placeholder="••••••••"
                      className={`flex-1 border bg-black/60 px-4 py-3 font-mono text-sm tracking-[0.3em] text-[#ffe3f3] caret-[#ff2d8c] outline-none transition placeholder:text-[var(--fg-mute)] ${
                        error
                          ? 'border-[#ff1c4a] shadow-[0_0_0_3px_rgba(255,28,74,0.18)]'
                          : 'border-[var(--rule-strong)] focus:border-[#ff2d8c] focus:shadow-[0_0_0_3px_rgba(255,45,140,0.18)]'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={unlocking}
                      className="group inline-flex items-center justify-center gap-3 border border-[#ff2d8c] bg-[#ff2d8c] px-6 py-3 font-display text-base uppercase tracking-[0.22em] text-[#150318] transition hover:bg-transparent hover:text-[#ff2d8c] disabled:opacity-70"
                    >
                      {unlocking ? (
                        <>
                          <span className="bb-live-dot" style={{ background: '#150318', width: 6, height: 6 }} />
                          Unlocking
                        </>
                      ) : (
                        <>
                          Enter <span className="text-xl">→</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span
                    className="font-mono text-[0.58rem] uppercase tracking-[0.25em] transition"
                    style={{ color: error ? '#ff1c4a' : 'var(--fg-mute)' }}
                    aria-live="polite"
                  >
                    {error
                      ? '× Access denied — verify the code'
                      : 'Auth handshake · zero session storage'}
                  </span>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Footer credits */}
        <div className="relative z-10 mt-auto border-t border-[var(--rule)] bg-black/40">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div className="flex items-center gap-3">
              <span className="bb-live-dot" />
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-[#d8a8e8]">
                REC &middot; Project Bodybuilding Network &middot; {new Date().getFullYear()}
              </span>
            </div>
            <span className="bb-clock" suppressHydrationWarning>
              {mounted ? clock : '--:--:-- UTC'}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
