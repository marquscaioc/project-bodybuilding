'use client';

import { useEffect, useRef, useState } from 'react';
import { useLabCard } from '@/lib/storeV2';
import { findImportableCards, toLabRows, type ImportableCard } from '@/lib/labImport';

/**
 * Load a saved V1 card into the lab so both engines score identical calls.
 * Read-only — importing never writes back to the live `scorecard:*` keys.
 */
export function ImportCardControl() {
  const importCard = useLabCard((s) => s.importCard);
  const importedFrom = useLabCard((s) => s.importedFrom);
  const reset = useLabCard((s) => s.reset);

  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<ImportableCard[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setCards(findImportableCards());
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(card: ImportableCard) {
    importCard({
      rows: toLabRows(card),
      nameA: card.nameA,
      nameB: card.nameB,
      label: card.label,
    });
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="border border-[var(--rule-strong)] px-3 py-1.5 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Import card ▾
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 top-full z-30 mt-1 min-w-[16rem] border border-[var(--rule-strong)] bg-[var(--bg-elev)] shadow-[0_18px_36px_-8px_rgba(0,0,0,0.7)]"
          >
            {cards.length === 0 ? (
              <p className="px-3 py-3 text-xs leading-relaxed text-[var(--fg-mute)]">
                No saved cards in this browser yet. Score something on a desk
                first, then come back.
              </p>
            ) : (
              cards.map((c) => (
                <button
                  key={c.storageKey}
                  type="button"
                  role="option"
                  aria-selected={importedFrom === c.label}
                  onClick={() => pick(c)}
                  className="flex w-full items-baseline justify-between gap-4 px-3 py-2 text-left transition hover:bg-white/[0.06]"
                >
                  <span className="font-display text-sm uppercase tracking-[0.15em] text-[var(--fg)]">
                    {c.label}
                  </span>
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--fg-mute)]">
                    {c.judgedCount} rows
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={reset}
        className="border border-[var(--rule)] px-3 py-1.5 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-mute)] transition hover:border-[var(--rule-strong)] hover:text-[var(--fg)]"
      >
        Clear card
      </button>

      {importedFrom && (
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-[var(--fg-mute)]">
          from {importedFrom}
        </span>
      )}
    </div>
  );
}
