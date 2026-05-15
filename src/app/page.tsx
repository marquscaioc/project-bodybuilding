'use client';

import { useEffect, useState } from 'react';
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
}> = [
  {
    href: '/project-bodybuilding',
    brand: 'Project: Bodybuilding',
    brandLine1: 'Project:',
    brandLine2: 'Bodybuilding',
    logoSrc: '/logos/dih.jpg',
    themeClass: 'theme-project-bodybuilding',
  },
  {
    href: '/xavier',
    brand: 'Xavier',
    brandLine1: 'Xavier',
    brandLine2: 'Scorecard',
    logoSrc: '/logos/xavier.jpg',
    themeClass: 'theme-xavier',
  },
  {
    href: '/marcus',
    brand: 'Marcus',
    brandLine1: 'Marcus',
    brandLine2: 'Scorecard',
    logoSrc: '/logos/muscle.jpg',
    themeClass: 'theme-marcus',
  },
  {
    href: '/superchat',
    brand: 'Superchat',
    brandLine1: 'Superchat',
    brandLine2: 'Scorecard',
    themeClass: 'theme-superchat',
  },
];

export default function HomePage() {
  const [customs, setCustoms] = useState<CustomJudgeConfig[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
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

  return (
    <main className="theme-wrap min-h-dvh">
      {/* ─── Hero ─── */}
      <section className="border-b border-[var(--rule)] bg-black/40">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-12 sm:py-16">
          <span className="font-display text-[0.7rem] uppercase tracking-[0.4em] text-[var(--accent)]">
            Project Bodybuilding
          </span>
          <h1 className="font-display text-4xl uppercase leading-none tracking-[0.04em] text-[var(--fg)] sm:text-6xl">
            Live <span className="text-[var(--accent)]">Scorecards</span>
          </h1>
          <p className="max-w-xl text-sm uppercase tracking-[0.15em] text-[var(--fg-dim)]">
            Pairwise margin scoring for 1v1 bodybuilder comparisons. Pick a
            judge below to enter their card, sign in with a username for cloud
            sync, or create your own.
          </p>
        </div>
      </section>

      {/* ─── Cloud ─── */}
      <Section
        title="Cloud sync"
        subtitle="Sign in with a username · scores sync in realtime to other judges"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CTACard
            href="/login"
            title="Sign in"
            description="Username only · no email · creates a synced personal scorecard"
            badge="cloud"
            badgeColor="#00d2d2"
          />
          <CTACard
            href="/live"
            title="Live judges"
            description="See every judge's scoreboard updating in realtime"
            badge="realtime"
            badgeColor="#00ff88"
          />
        </div>
      </Section>

      {/* ─── Built-in local judges ─── */}
      <Section
        title="Local scorecards"
        subtitle="Shared password protected · data lives in this browser only"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {BUILTINS.map((b) => (
            <ScorecardTile
              key={b.href}
              href={b.href}
              brand={b.brand}
              brandLine1={b.brandLine1}
              brandLine2={b.brandLine2}
              logoSrc={b.logoSrc}
              themeClass={b.themeClass}
              locked
            />
          ))}
        </div>
      </Section>

      {/* ─── Custom judges ─── */}
      {customs.length > 0 && (
        <Section
          title="Your judges"
          subtitle="Custom scorecards saved on this browser"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {customs.map((c) => (
              <ScorecardTile
                key={c.id}
                href={`/j/${c.id}`}
                brand={c.name}
                brandLine1={c.brandLine1}
                brandLine2={c.brandLine2}
                logoSrc={c.logoDataUrl}
                themeStyle={paletteToStyle(c)}
                locked
              />
            ))}
          </div>
        </Section>
      )}

      {/* ─── New ─── */}
      <Section title="Add a new judge">
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="group flex w-full items-center justify-between gap-3 border border-dashed border-[var(--rule-strong)] bg-black/40 p-5 text-left transition hover:border-[var(--accent)] sm:w-auto sm:px-8"
        >
          <div className="flex flex-col">
            <span className="font-display text-xl uppercase tracking-[0.2em] text-[var(--fg)] group-hover:text-[var(--accent)]">
              + New judge
            </span>
            <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
              Pick a name, vibe, optional logo · saved locally
            </span>
          </div>
          <span className="font-display text-3xl text-[var(--fg-mute)] group-hover:text-[var(--accent)]">
            →
          </span>
        </button>
      </Section>

      <footer className="border-t border-[var(--rule)] px-6 py-6 text-center">
        <span className="text-[0.6rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
          Project Bodybuilding · scoring app · {new Date().getFullYear()}
        </span>
      </footer>

      <JudgeEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
    </main>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-5 flex flex-col gap-1">
        <h2 className="font-display text-2xl uppercase tracking-[0.25em] text-[var(--fg)] sm:text-3xl">
          {title}
        </h2>
        {subtitle && (
          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
            {subtitle}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function ScorecardTile({
  href,
  brand,
  brandLine1,
  brandLine2,
  logoSrc,
  themeClass,
  themeStyle,
  locked,
}: {
  href: string;
  brand: string;
  brandLine1: string;
  brandLine2: string;
  logoSrc?: string;
  themeClass?: string;
  themeStyle?: React.CSSProperties;
  locked?: boolean;
}) {
  return (
    <Link
      href={href}
      title={`Open ${brand}`}
      className={`theme-wrap group relative block overflow-hidden border border-[var(--rule-strong)] bg-[var(--bg)] transition hover:border-[var(--mosaic-1,var(--accent))] ${themeClass ?? ''}`}
      style={themeStyle}
    >
      <div
        className="relative flex items-center gap-3 p-3"
        style={{
          background:
            'linear-gradient(160deg, var(--mosaic-5, var(--bg-glow)) 0%, var(--bg) 90%)',
        }}
      >
        {logoSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoSrc}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            style={{
              boxShadow:
                '0 0 0 1.5px var(--mosaic-1, var(--accent)), 0 0 14px -4px var(--mosaic-1, var(--accent))',
            }}
          />
        ) : (
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-xs uppercase tracking-[0.15em]"
            style={{
              background: 'var(--mosaic-5, var(--bg-glow))',
              border: '1.5px solid var(--mosaic-1, var(--accent))',
              color: 'var(--mosaic-3, var(--accent))',
            }}
          >
            {brandLine1.slice(0, 2)}
          </span>
        )}
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-display text-base uppercase tracking-[0.04em] text-[var(--fg)]">
            {brandLine1}
          </span>
          <span className="truncate font-display text-[0.65rem] uppercase tracking-[0.18em] text-[var(--mosaic-3,var(--accent))]">
            {brandLine2}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--rule)] bg-black/50 px-3 py-1.5">
        <span className="flex items-center gap-1 text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
          {locked && (
            <>
              <LockIcon />
              Password
            </>
          )}
        </span>
        <span className="font-display text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-dim)] group-hover:text-[var(--mosaic-1,var(--accent))]">
          Open →
        </span>
      </div>
      {/* Mosaic strip */}
      <div className="flex h-0.5">
        <span className="flex-1" style={{ background: 'var(--mosaic-1, var(--accent))' }} />
        <span className="flex-1" style={{ background: 'var(--mosaic-2, var(--accent))' }} />
        <span className="flex-1" style={{ background: 'var(--mosaic-3, var(--accent))' }} />
        <span className="flex-1" style={{ background: 'var(--mosaic-4, var(--accent))' }} />
        <span className="flex-1" style={{ background: 'var(--mosaic-5, var(--accent))' }} />
      </div>
    </Link>
  );
}

function CTACard({
  href,
  title,
  description,
  badge,
  badgeColor,
}: {
  href: string;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 border border-[var(--rule-strong)] bg-black/40 p-5 transition hover:border-[var(--accent)]"
    >
      <span
        className="self-start border px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-[0.25em]"
        style={{ borderColor: badgeColor, color: badgeColor }}
      >
        {badge}
      </span>
      <span className="font-display text-2xl uppercase tracking-[0.2em] text-[var(--fg)] group-hover:text-[var(--accent)]">
        {title}
      </span>
      <span className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
        {description}
      </span>
    </Link>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
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
