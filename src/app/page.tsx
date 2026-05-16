'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { JudgeEditor } from '@/components/JudgeEditor';
import {
  CUSTOM_JUDGES_EVENT,
  loadCustomJudges,
  paletteToStyle,
} from '@/lib/customJudges';
import type { CustomJudgeConfig } from '@/types/customJudge';

const BUILTINS: Array<{
  href: string;
  brand: string;
  brandLine1: string;
  brandLine2: string;
  logoSrc?: string;
  themeClass: string;
  tag: string;
}> = [
  {
    href: '/project-bodybuilding',
    brand: 'Project: Bodybuilding',
    brandLine1: 'Project',
    brandLine2: 'Bodybuilding',
    logoSrc: '/logos/dih.jpg',
    themeClass: 'theme-project-bodybuilding',
    tag: 'J/01',
  },
  {
    href: '/xavier',
    brand: 'Xavier',
    brandLine1: 'Xavier',
    brandLine2: 'Scorecard',
    logoSrc: '/logos/xavier.jpg',
    themeClass: 'theme-xavier',
    tag: 'J/02',
  },
  {
    href: '/marcus',
    brand: 'Marcus',
    brandLine1: 'Marcus',
    brandLine2: 'Scorecard',
    logoSrc: '/logos/muscle.jpg',
    themeClass: 'theme-marcus',
    tag: 'J/03',
  },
  {
    href: '/superchat',
    brand: 'Superchat',
    brandLine1: 'Superchat',
    brandLine2: 'Scorecard',
    themeClass: 'theme-superchat',
    tag: 'J/04',
  },
];

const MARQUEE = [
  'Dorian Yates',
  'Ronnie Coleman',
  'Jay Cutler',
  'Kai Greene',
  'Phil Heath',
  'Chris Bumstead',
  'Samson Dauda',
  'Hadi Choopan',
  'Derek Lunsford',
  'Arnold Schwarzenegger',
  'Lee Haney',
  'Flex Wheeler',
];

const PANEL_FACES = [
  '/logos/dih.jpg',
  '/logos/xavier.jpg',
  '/logos/muscle.jpg',
];

export default function HomePage() {
  const [customs, setCustoms] = useState<CustomJudgeConfig[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [clock, setClock] = useState<string>('--:--:--');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function refresh() {
      setCustoms(loadCustomJudges());
    }
    refresh();
    window.addEventListener(CUSTOM_JUDGES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CUSTOM_JUDGES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
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

  const judgeCount = useMemo(
    () => BUILTINS.length + customs.length + 1, // +1 open scorecard
    [customs.length],
  );

  return (
    <main className="theme-wrap min-h-dvh">
      {/* ═══════════ HERO — broadcast stage ═══════════ */}
      <section className="bb-stage relative">
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
              Broadcast&nbsp;//&nbsp;{judgeCount.toString().padStart(2, '0')} Channels
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
              <span className="bb-live-dot" style={{ background: '#150318', boxShadow: 'none', animation: 'none' }} />
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
              Pick a judge below to enter their card, sign in with a username
              for realtime cloud sync, or build your own scoring panel from
              scratch.
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
                <span className="bb-panel-face grid place-items-center font-mono text-[0.55rem] tracking-[0.15em] text-[#ffe3f3]" style={{ background: '#2a0e3d' }}>
                  +{BUILTINS.length + customs.length}
                </span>
              </div>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.28em] text-[#d8a8e8]">
                Panel of judges &middot; ready for the call
              </span>
            </div>
          </div>
        </div>

        {/* Bottom stat strip */}
        <div className="relative z-10 grid grid-cols-2 border-t border-[var(--rule-strong)] bg-black/40 sm:grid-cols-4">
          <div className="bb-stat">
            <div className="bb-stat-num">{judgeCount.toString().padStart(2, '0')}</div>
            <div className="bb-stat-label">Active Channels</div>
          </div>
          <div className="bb-stat">
            <div className="bb-stat-num" style={{ color: '#ff7a3c' }}>1<span className="text-[#d8a8e8]">v</span>1</div>
            <div className="bb-stat-label">Match Format</div>
          </div>
          <div className="bb-stat">
            <div className="bb-stat-num" style={{ color: '#ffc94e' }}>∞</div>
            <div className="bb-stat-label">Realtime Sync</div>
          </div>
          <div className="bb-stat">
            <div className="bb-stat-num" style={{ color: '#b04ad0' }}>0.5</div>
            <div className="bb-stat-label">Margin Resolution</div>
          </div>
        </div>
      </section>

      {/* ═══════════ MARQUEE — legends ticker ═══════════ */}
      <div className="bb-marquee" aria-hidden>
        <div className="bb-marquee-track">
          {[...MARQUEE, ...MARQUEE].map((name, i) => (
            <span key={i}>{name}</span>
          ))}
        </div>
      </div>

      {/* ═══════════ CLOUD — feature bento ═══════════ */}
      <section className="mx-auto max-w-[1400px] px-6 py-16 sm:px-10">
        <SectionHead
          idx="01 //"
          title="Cloud Sync"
          sub="Sign in with a username — scores propagate in realtime across every judge on the floor."
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Link
            href="/login"
            className="bb-feature group md:col-span-3 flex flex-col gap-6 p-8 sm:p-10"
          >
            <div className="flex items-center justify-between">
              <span className="bb-stamp text-[#00d2d2]">
                <span className="bb-live-dot" style={{ background: '#00d2d2', width: 6, height: 6, animation: 'none', boxShadow: 'none' }} />
                Cloud / Encrypted
              </span>
              <span className="font-mono text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
                Auth&nbsp;01
              </span>
            </div>
            <h3 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-none tracking-[0.04em] text-[#ffe3f3]">
              Sign in &amp; <span className="text-[#ff2d8c]">go live</span>
            </h3>
            <p className="max-w-md text-sm leading-relaxed text-[#d8a8e8]">
              Username-only login &mdash; no email, no friction. Your card syncs
              instantly to anyone watching the live board.
            </p>
            <div className="mt-auto flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.25em] text-[#ff2d8c] transition group-hover:gap-4">
              Enter the network <span className="text-lg">→</span>
            </div>
          </Link>

          <Link
            href="/live"
            className="bb-feature group md:col-span-2 flex flex-col gap-6 p-8 sm:p-10"
            style={{
              background:
                'linear-gradient(160deg, rgba(0,210,210,0.10) 0%, transparent 60%), linear-gradient(180deg, #04141a 0%, #050208 100%)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="bb-stamp text-[#00ff88]">
                <span className="bb-live-dot" style={{ background: '#00ff88', width: 6, height: 6 }} />
                Realtime
              </span>
              <span className="font-mono text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
                Feed&nbsp;02
              </span>
            </div>
            <h3 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] leading-none tracking-[0.04em] text-[#e6f6f8]">
              Live <span className="text-[#00d2d2]">Judges</span>
            </h3>
            <p className="text-sm leading-relaxed text-[#7be9ec]">
              Watch every judge&apos;s scoreboard update as it happens — the
              control room view.
            </p>
            <div className="mt-auto flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.25em] text-[#00d2d2] transition group-hover:gap-4">
              Open feed <span className="text-lg">→</span>
            </div>
          </Link>
        </div>
      </section>

      {/* ═══════════ OPEN SCORECARD ═══════════ */}
      <section className="mx-auto max-w-[1400px] px-6 py-8 sm:px-10">
        <SectionHead
          idx="02 //"
          title="Open Scorecard"
          sub="Public link · no password · share freely with anyone watching."
        />

        <Link
          href="/open"
          className="bb-feature theme-project-bodybuilding group flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:gap-10"
        >
          <div className="flex items-center gap-5">
            <span className="grid h-16 w-16 place-items-center font-display text-3xl tracking-[0.08em] text-[#150318]" style={{ background: 'var(--mosaic-1)' }}>
              OP
            </span>
            <div>
              <div className="font-display text-3xl uppercase tracking-[0.06em] text-[#ffe3f3]">
                Open <span className="text-[var(--mosaic-1)]">Scorecard</span>
              </div>
              <div className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[#d8a8e8]">
                Anonymous · sharable · zero password
              </div>
            </div>
          </div>
          <span className="hidden h-px flex-1 bg-[var(--rule)] sm:block" />
          <div className="flex items-center gap-3 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-[var(--mosaic-1)] transition group-hover:gap-5">
            Launch <span className="text-lg">→</span>
          </div>
        </Link>
      </section>

      {/* ═══════════ JUDGES — local scorecards grid ═══════════ */}
      <section className="mx-auto max-w-[1400px] px-6 py-12 sm:px-10">
        <SectionHead
          idx="03 //"
          title="Local Scorecards"
          sub="Password-protected · stored only in this browser · curated panel."
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {BUILTINS.map((b, i) => (
            <ScorecardTile
              key={b.href}
              href={b.href}
              brandLine1={b.brandLine1}
              brandLine2={b.brandLine2}
              logoSrc={b.logoSrc}
              themeClass={b.themeClass}
              tag={b.tag}
              index={i}
              locked
            />
          ))}
        </div>
      </section>

      {/* ═══════════ CUSTOM JUDGES ═══════════ */}
      {customs.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-6 py-12 sm:px-10">
          <SectionHead
            idx="04 //"
            title="Your Judges"
            sub="Custom scorecards saved on this browser."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {customs.map((c, i) => (
              <ScorecardTile
                key={c.id}
                href={`/j/${c.id}`}
                brandLine1={c.brandLine1}
                brandLine2={c.brandLine2}
                logoSrc={c.logoDataUrl}
                themeStyle={paletteToStyle(c)}
                tag={`C/${String(i + 1).padStart(2, '0')}`}
                index={i}
                locked
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ NEW JUDGE ═══════════ */}
      <section className="mx-auto max-w-[1400px] px-6 pb-20 pt-8 sm:px-10">
        <SectionHead
          idx={customs.length > 0 ? '05 //' : '04 //'}
          title="Add a New Judge"
          sub="Pick a name, vibe, optional logo — saved locally."
        />
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="bb-new group"
        >
          <div className="flex items-center gap-5">
            <span className="grid h-14 w-14 place-items-center border border-[var(--rule-strong)] font-display text-3xl text-[#ffe3f3] transition group-hover:border-[#ff2d8c] group-hover:text-[#ff2d8c]">
              +
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-display text-2xl uppercase tracking-[0.12em] text-[#ffe3f3] group-hover:text-[#ff2d8c]">
                Commission a Judge
              </span>
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[#d8a8e8]">
                Custom palette · logo · brand line · stored locally
              </span>
            </div>
          </div>
          <span className="font-display text-4xl text-[var(--fg-mute)] transition group-hover:text-[#ff2d8c]">
            →
          </span>
        </button>
      </section>

      {/* ═══════════ FOOTER — broadcast credits ═══════════ */}
      <footer className="border-t border-[var(--rule)] bg-black/40">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex items-center gap-3">
            <span className="bb-live-dot" />
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-[#d8a8e8]">
              REC &middot; Project Bodybuilding Network &middot; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-[var(--fg-mute)]">
              Pairwise · half-step margins · cloud-synced
            </span>
            <span className="bb-clock" suppressHydrationWarning>
              {mounted ? clock : '--:--:-- UTC'}
            </span>
          </div>
        </div>
      </footer>

      <JudgeEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
    </main>
  );
}

function SectionHead({
  idx,
  title,
  sub,
}: {
  idx: string;
  title: string;
  sub?: string;
}) {
  return (
    <header className="bb-section-head">
      <span className="bb-section-idx">{idx}</span>
      <h2 className="bb-section-title">{title}</h2>
      {sub && <span className="bb-section-sub">{sub}</span>}
    </header>
  );
}

function ScorecardTile({
  href,
  brandLine1,
  brandLine2,
  logoSrc,
  themeClass,
  themeStyle,
  tag,
  index,
  locked,
}: {
  href: string;
  brandLine1: string;
  brandLine2: string;
  logoSrc?: string;
  themeClass?: string;
  themeStyle?: React.CSSProperties;
  tag: string;
  index: number;
  locked?: boolean;
}) {
  return (
    <Link
      href={href}
      title={`Open ${brandLine1}`}
      className={`bb-tile theme-wrap ${themeClass ?? ''}`}
      style={{
        ...themeStyle,
        animationDelay: `${0.05 * index}s`,
      }}
    >
      <span className="bb-tile-tag">{tag}</span>
      {logoSrc ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={logoSrc} alt="" className="bb-tile-avatar" />
      ) : (
        <span
          className="bb-tile-avatar grid place-items-center font-display text-sm uppercase"
          style={{
            background: 'var(--mosaic-5, var(--bg-glow))',
            color: 'var(--mosaic-3, var(--accent))',
          }}
        >
          {brandLine1.slice(0, 2)}
        </span>
      )}
      <span className="bb-tile-name">
        <span className="bb-tile-name-1">{brandLine1}</span>
        {brandLine2 && <span className="bb-tile-name-2">{brandLine2}</span>}
      </span>
      {locked && (
        <span
          aria-label="Password protected"
          className="shrink-0 self-end pb-0.5 text-[var(--fg-mute)] transition group-hover:text-[var(--mosaic-1,var(--accent))]"
        >
          <LockIcon />
        </span>
      )}
    </Link>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
