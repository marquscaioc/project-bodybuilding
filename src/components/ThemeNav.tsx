'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const THEMES = [
  { href: '/project-bodybuilding', label: 'Project Bodybuilding', swatch: '#ff8a3d' },
  { href: '/xavier', label: 'Xavier', swatch: '#4dd0e1' },
  { href: '/marcus', label: 'Marcus', swatch: '#f5a3b6' },
  { href: '/superchat', label: 'Superchat', swatch: '#ff1c50' },
] as const;

export function ThemeNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Color theme"
      className="flex flex-wrap items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.25em]"
    >
      <span className="mr-1 text-[var(--fg-mute)]">Theme</span>
      {THEMES.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              'group inline-flex items-center gap-1.5 border px-2.5 py-1 transition',
              active
                ? 'border-[var(--accent)] text-[var(--fg)]'
                : 'border-[var(--rule)] text-[var(--fg-dim)] hover:border-[var(--rule-strong)] hover:text-[var(--fg)]',
            )}
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: t.swatch }}
            />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
