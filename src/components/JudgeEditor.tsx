'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import type { CustomJudgeConfig } from '@/types/customJudge';
import {
  deleteCustomJudge,
  fileToCompressedDataUrl,
  paletteToStyle,
  slugifyName,
  upsertCustomJudge,
} from '@/lib/customJudges';

const DEFAULT_PALETTE: Omit<CustomJudgeConfig, 'id' | 'createdAt' | 'name' | 'brandLine1' | 'brandLine2'> = {
  bg: '#0a0a0a',
  bgGlow: '#181818',
  fg: '#f5f5f5',
  mosaic1: '#e10600',
  mosaic2: '#ff8a3d',
  mosaic3: '#ffc94e',
  mosaic4: '#ffaecd',
  mosaic5: '#2a0e1c',
};

export function JudgeEditor({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  /** Pre-fill the form with an existing judge to edit. Null = new judge. */
  initial?: CustomJudgeConfig | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = !!initial;
  const [name, setName] = useState('');
  const [brandLine1, setBrandLine1] = useState('');
  const [brandLine2, setBrandLine2] = useState('Scorecard');
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [palette, setPalette] = useState(DEFAULT_PALETTE);
  const [error, setError] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hydrate from `initial` whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setName(initial.name);
      setBrandLine1(initial.brandLine1);
      setBrandLine2(initial.brandLine2);
      setLogoDataUrl(initial.logoDataUrl);
      setPalette({
        bg: initial.bg,
        bgGlow: initial.bgGlow,
        fg: initial.fg,
        mosaic1: initial.mosaic1,
        mosaic2: initial.mosaic2,
        mosaic3: initial.mosaic3,
        mosaic4: initial.mosaic4,
        mosaic5: initial.mosaic5,
      });
    } else {
      setName('');
      setBrandLine1('');
      setBrandLine2('Scorecard');
      setLogoDataUrl(undefined);
      setPalette(DEFAULT_PALETTE);
    }
  }, [open, initial]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleLogoFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    setLogoLoading(true);
    setError(null);
    try {
      const url = await fileToCompressedDataUrl(file, 400, 0.85);
      setLogoDataUrl(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLogoLoading(false);
    }
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (!brandLine1.trim()) {
      setError('Brand line 1 is required');
      return;
    }
    const id = initial?.id ?? slugifyName(trimmedName);
    const config: CustomJudgeConfig = {
      id,
      name: trimmedName,
      brandLine1: brandLine1.trim(),
      brandLine2: brandLine2.trim() || 'Scorecard',
      logoDataUrl,
      ...palette,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    upsertCustomJudge(config);
    onClose();
    router.push(`/j/${id}`);
  }

  function handleDelete() {
    if (!initial) return;
    if (!confirm(`Delete judge "${initial.name}" and all their scoring data?`)) return;
    deleteCustomJudge(initial.id);
    onClose();
    router.push('/project-bodybuilding');
  }

  if (!open) return null;

  // Build a live preview style from the current form palette.
  const previewStyle = paletteToStyle({
    id: 'preview',
    name,
    brandLine1,
    brandLine2,
    createdAt: 0,
    ...palette,
    logoDataUrl,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden border border-[var(--rule)] bg-[var(--bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--rule)] bg-black/60 px-5 py-3">
          <div className="flex flex-col">
            <span className="font-display text-lg uppercase tracking-[0.3em] text-[var(--fg)]">
              {isEditing ? 'Edit judge' : 'New judge'}
            </span>
            <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
              Each judge keeps their own scorecard, photos, and styling
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-display text-2xl leading-none text-[var(--fg-dim)] hover:text-[var(--accent)]"
            aria-label="Close editor"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
            {/* ── Form ── */}
            <div className="flex flex-col gap-4">
              <Field label="Judge name (header)">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Marqus Caioc"
                  className="w-full border border-[var(--rule-strong)] bg-black/60 px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Title — line 1">
                  <input
                    type="text"
                    value={brandLine1}
                    onChange={(e) => setBrandLine1(e.target.value)}
                    placeholder="Marqus"
                    className="w-full border border-[var(--rule-strong)] bg-black/60 px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                  />
                </Field>
                <Field label="Title — line 2">
                  <input
                    type="text"
                    value={brandLine2}
                    onChange={(e) => setBrandLine2(e.target.value)}
                    placeholder="Scorecard"
                    className="w-full border border-[var(--rule-strong)] bg-black/60 px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                  />
                </Field>
              </div>

              <Field label="Logo (optional, square works best)">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="border border-[var(--rule-strong)] bg-black/60 px-3 py-2 font-display text-[0.7rem] uppercase tracking-[0.25em] text-[var(--fg)] hover:border-[var(--accent)]"
                  >
                    {logoLoading ? 'Compressing…' : logoDataUrl ? 'Replace logo' : 'Upload logo'}
                  </button>
                  {logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoDataUrl(undefined)}
                      className="border border-[var(--rule)] bg-black/60 px-3 py-2 font-display text-[0.7rem] uppercase tracking-[0.25em] text-[var(--fg-dim)] hover:text-[var(--accent)]"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoFile(e.target.files?.[0])}
                  />
                </div>
                <span className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--fg-mute)]">
                  Auto-resized to 400px and saved in your browser only.
                </span>
              </Field>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Swatch label="Background" value={palette.bg} onChange={(v) => setPalette((p) => ({ ...p, bg: v }))} />
                <Swatch label="Glow" value={palette.bgGlow} onChange={(v) => setPalette((p) => ({ ...p, bgGlow: v }))} />
                <Swatch label="Foreground" value={palette.fg} onChange={(v) => setPalette((p) => ({ ...p, fg: v }))} />
                <Swatch label="Deep" value={palette.mosaic5} onChange={(v) => setPalette((p) => ({ ...p, mosaic5: v }))} />
                <Swatch label="Primary (poses)" value={palette.mosaic1} onChange={(v) => setPalette((p) => ({ ...p, mosaic1: v }))} />
                <Swatch label="Secondary (cats)" value={palette.mosaic2} onChange={(v) => setPalette((p) => ({ ...p, mosaic2: v }))} />
                <Swatch label="Tertiary (gold)" value={palette.mosaic3} onChange={(v) => setPalette((p) => ({ ...p, mosaic3: v }))} />
                <Swatch label="Companion" value={palette.mosaic4} onChange={(v) => setPalette((p) => ({ ...p, mosaic4: v }))} />
              </div>

              {error && (
                <div className="border border-[var(--accent)]/60 bg-[var(--accent-soft)] px-3 py-2 text-[0.7rem] uppercase tracking-[0.2em] text-[var(--fg)]">
                  {error}
                </div>
              )}
            </div>

            {/* ── Preview ── */}
            <div className="flex flex-col gap-2">
              <span className="font-display text-[0.6rem] uppercase tracking-[0.3em] text-[var(--fg-mute)]">
                Live preview
              </span>
              <div
                className="theme-wrap relative overflow-hidden border border-white/20 p-4"
                style={previewStyle}
              >
                <div className="title-block flex flex-col gap-3 border bg-black p-4">
                  <div className="flex flex-col">
                    <span className="title-line title-line-1 font-display uppercase tracking-[0.04em] text-[var(--fg)]">
                      {brandLine1 || 'Brand'}
                    </span>
                    <span className="title-line title-line-2 mt-2 inline-block w-fit max-w-full border-t-2 border-[var(--accent)] pt-2 font-display uppercase tracking-[0.14em] text-[var(--accent)]">
                      {brandLine2 || 'Scorecard'}
                    </span>
                  </div>
                  {logoDataUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={logoDataUrl}
                      alt=""
                      className="mx-auto h-20 w-20 rounded-full object-cover ring-2"
                      style={{ borderColor: palette.mosaic1 }}
                    />
                  )}
                  <div className="flex gap-1">
                    <span
                      className="h-3 flex-1"
                      style={{ background: palette.mosaic1 }}
                    />
                    <span
                      className="h-3 flex-1"
                      style={{ background: palette.mosaic2 }}
                    />
                    <span
                      className="h-3 flex-1"
                      style={{ background: palette.mosaic3 }}
                    />
                    <span
                      className="h-3 flex-1"
                      style={{ background: palette.mosaic4 }}
                    />
                    <span
                      className="h-3 flex-1"
                      style={{ background: palette.mosaic5 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-[var(--rule)] bg-black/60 px-5 py-3">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              className="border border-red-500/60 bg-red-500/10 px-3 py-2 font-display text-[0.65rem] uppercase tracking-[0.25em] text-red-400 hover:bg-red-500 hover:text-white"
            >
              Delete judge
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-[var(--rule-strong)] bg-transparent px-4 py-2 font-display text-[0.7rem] uppercase tracking-[0.25em] text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 font-display text-[0.7rem] uppercase tracking-[0.25em] text-[var(--strip-fg)] hover:opacity-90"
            >
              {isEditing ? 'Save changes' : 'Create judge'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-display text-[0.65rem] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Swatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
        {label}
      </span>
      <div className="flex items-stretch border border-[var(--rule-strong)]">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer border-r border-[var(--rule-strong)] bg-black/60 p-0"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') onChange(v);
          }}
          className={clsx(
            'flex-1 min-w-0 bg-black/60 px-2 font-mono text-[0.7rem] text-[var(--fg)] outline-none',
          )}
        />
      </div>
    </label>
  );
}
