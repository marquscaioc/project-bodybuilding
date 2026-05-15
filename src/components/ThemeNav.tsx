'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  CUSTOM_JUDGES_EVENT,
  loadCustomJudges,
} from '@/lib/customJudges';
import type { CustomJudgeConfig } from '@/types/customJudge';
import { JudgeEditor } from './JudgeEditor';

const BUILTIN = [
  { href: '/project-bodybuilding', label: 'Project Bodybuilding', swatch: '#ff2d8c' },
  { href: '/xavier', label: 'Xavier', swatch: '#4dd0e1' },
  { href: '/marcus', label: 'Marcus', swatch: '#ff3d8b' },
  { href: '/superchat', label: 'Superchat', swatch: '#ff1c50' },
] as const;

export function ThemeNav() {
  const pathname = usePathname();
  const [customJudges, setCustomJudges] = useState<CustomJudgeConfig[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CustomJudgeConfig | null>(null);

  useEffect(() => {
    function refresh() {
      setCustomJudges(loadCustomJudges());
    }
    refresh();
    window.addEventListener(CUSTOM_JUDGES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CUSTOM_JUDGES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  function startNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function startEdit(j: CustomJudgeConfig) {
    setEditing(j);
    setEditorOpen(true);
  }

  return (
    <>
      <nav
        aria-label="Judge / theme"
        className="flex flex-wrap items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.25em]"
      >
        <span className="mr-1 text-[var(--fg-mute)]">Judge</span>
        {BUILTIN.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                'inline-flex items-center gap-1.5 border px-2.5 py-1 transition',
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

        {customJudges.length > 0 && (
          <span className="mx-1 h-4 w-px bg-[var(--rule)]" aria-hidden />
        )}

        {customJudges.map((j) => {
          const href = `/j/${j.id}`;
          const active = pathname === href;
          return (
            <span key={j.id} className="inline-flex items-stretch">
              <Link
                href={href}
                className={clsx(
                  'inline-flex items-center gap-1.5 border border-r-0 px-2.5 py-1 transition',
                  active
                    ? 'border-[var(--accent)] text-[var(--fg)]'
                    : 'border-[var(--rule)] text-[var(--fg-dim)] hover:border-[var(--rule-strong)] hover:text-[var(--fg)]',
                )}
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: j.mosaic1 }}
                />
                {j.name}
              </Link>
              <button
                type="button"
                onClick={() => startEdit(j)}
                title={`Edit ${j.name}`}
                className={clsx(
                  'inline-flex items-center border px-1.5 transition',
                  active
                    ? 'border-[var(--accent)] text-[var(--fg)]'
                    : 'border-[var(--rule)] text-[var(--fg-dim)] hover:border-[var(--rule-strong)] hover:text-[var(--fg)]',
                )}
                aria-label={`Edit ${j.name}`}
              >
                ✎
              </button>
            </span>
          );
        })}

        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-1 border border-dashed border-[var(--rule-strong)] px-2.5 py-1 font-display text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          title="Add a new judge with custom logo + palette"
        >
          + New judge
        </button>
      </nav>

      <JudgeEditor
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
      />
    </>
  );
}
