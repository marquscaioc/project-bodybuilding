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

type Palette = Pick<
  CustomJudgeConfig,
  'bg' | 'bgGlow' | 'fg' | 'mosaic1' | 'mosaic2' | 'mosaic3' | 'mosaic4' | 'mosaic5'
>;

/**
 * Curated palette presets, named for the vibe they convey. The user
 * picks one as a starting point; advanced color tweaking is hidden
 * behind a "Customize" toggle so the default flow is one click.
 */
const PRESETS: { id: string; label: string; palette: Palette }[] = [
  {
    id: 'crimson',
    label: 'Crimson',
    palette: {
      bg: '#0a0a0a',
      bgGlow: '#181818',
      fg: '#f5f5f5',
      mosaic1: '#e10600',
      mosaic2: '#ff8a3d',
      mosaic3: '#ffc94e',
      mosaic4: '#ffaecd',
      mosaic5: '#2a0e1c',
    },
  },
  {
    id: 'vaporwave',
    label: 'Vaporwave',
    palette: {
      bg: '#1a0628',
      bgGlow: '#6e2c8e',
      fg: '#ffe3f3',
      mosaic1: '#ff2d8c',
      mosaic2: '#ff7a3c',
      mosaic3: '#ffc94e',
      mosaic4: '#ffaecd',
      mosaic5: '#4a1a5b',
    },
  },
  {
    id: 'cyber-teal',
    label: 'Cyber Teal',
    palette: {
      bg: '#050608',
      bgGlow: '#1d6e7a',
      fg: '#e6f6f8',
      mosaic1: '#00d2d2',
      mosaic2: '#ff1c50',
      mosaic3: '#7be9ec',
      mosaic4: '#ff6a4a',
      mosaic5: '#1d6e7a',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    palette: {
      bg: '#2a0f20',
      bgGlow: '#6b2a4a',
      fg: '#fdeede',
      mosaic1: '#ff3d8b',
      mosaic2: '#ff8c42',
      mosaic3: '#ffd166',
      mosaic4: '#c98ec0',
      mosaic5: '#6b2a4a',
    },
  },
  {
    id: 'ice',
    label: 'Ice',
    palette: {
      bg: '#061827',
      bgGlow: '#103655',
      fg: '#eaf6fa',
      mosaic1: '#4dd0e1',
      mosaic2: '#f0a040',
      mosaic3: '#ffd166',
      mosaic4: '#eaf6fa',
      mosaic5: '#103655',
    },
  },
  {
    id: 'mono',
    label: 'Mono',
    palette: {
      bg: '#0c0c0c',
      bgGlow: '#1f1f1f',
      fg: '#f0f0f0',
      mosaic1: '#ffffff',
      mosaic2: '#a0a0a0',
      mosaic3: '#ffffff',
      mosaic4: '#666666',
      mosaic5: '#1f1f1f',
    },
  },
];

const DEFAULT_PRESET = PRESETS[0];

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
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [palette, setPalette] = useState<Palette>(DEFAULT_PRESET.palette);
  const [activePresetId, setActivePresetId] = useState<string | null>(
    DEFAULT_PRESET.id,
  );
  const [showCustom, setShowCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowCustom(false);
    if (initial) {
      setName(initial.name);
      setLogoDataUrl(initial.logoDataUrl);
      const p = {
        bg: initial.bg,
        bgGlow: initial.bgGlow,
        fg: initial.fg,
        mosaic1: initial.mosaic1,
        mosaic2: initial.mosaic2,
        mosaic3: initial.mosaic3,
        mosaic4: initial.mosaic4,
        mosaic5: initial.mosaic5,
      };
      setPalette(p);
      // Detect if the existing palette matches a preset.
      const match = PRESETS.find((preset) => sameP(preset.palette, p));
      setActivePresetId(match?.id ?? null);
    } else {
      setName('');
      setLogoDataUrl(undefined);
      setPalette(DEFAULT_PRESET.palette);
      setActivePresetId(DEFAULT_PRESET.id);
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

  function applyPreset(presetId: string) {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setPalette(preset.palette);
    setActivePresetId(presetId);
  }

  function patchPalette(patch: Partial<Palette>) {
    setPalette((p) => ({ ...p, ...patch }));
    setActivePresetId(null); // any manual edit drops out of "preset" mode
  }

  async function handleLogoFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    setLogoLoading(true);
    setError(null);
    try {
      setLogoDataUrl(await fileToCompressedDataUrl(file, 400, 0.85));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLogoLoading(false);
    }
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Pick a name first');
      return;
    }
    const id = initial?.id ?? slugifyName(trimmed);
    const config: CustomJudgeConfig = {
      id,
      name: trimmed,
      brandLine1: trimmed,
      brandLine2: 'Scorecard',
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

  const previewStyle = paletteToStyle({
    id: 'preview',
    name,
    brandLine1: name || 'Brand',
    brandLine2: 'Scorecard',
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
        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden border border-[var(--rule)] bg-[var(--bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--rule)] bg-black/60 px-5 py-3">
          <span className="font-display text-base uppercase tracking-[0.3em] text-[var(--fg)]">
            {isEditing ? 'Edit judge' : 'New judge'}
          </span>
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
          <div className="flex flex-col gap-6">
            {/* ── Step 1: name ── */}
            <Step n={1} label="Name">
              <input
                type="text"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                placeholder="e.g. Marqus"
                className="w-full border border-[var(--rule-strong)] bg-black/60 px-3 py-2 text-lg text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              />
            </Step>

            {/* ── Step 2: logo ── */}
            <Step n={2} label="Logo (optional)">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative h-16 w-16 overflow-hidden border border-[var(--rule-strong)] bg-black/40 transition hover:border-[var(--accent)]"
                >
                  {logoDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={logoDataUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-2xl text-[var(--fg-mute)]">
                      +
                    </span>
                  )}
                  {logoLoading && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/60 font-display text-[0.55rem] uppercase tracking-[0.2em] text-[var(--accent)]">
                      …
                    </span>
                  )}
                </button>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="border border-[var(--rule-strong)] bg-black/60 px-3 py-1.5 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg)] hover:border-[var(--accent)]"
                  >
                    {logoDataUrl ? 'Replace' : 'Upload'}
                  </button>
                  {logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoDataUrl(undefined)}
                      className="text-left text-[0.6rem] uppercase tracking-[0.25em] text-[var(--fg-mute)] hover:text-[var(--accent)]"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleLogoFile(e.target.files?.[0])}
                />
              </div>
            </Step>

            {/* ── Step 3: palette ── */}
            <Step n={3} label="Pick a vibe">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PRESETS.map((preset) => (
                  <PresetSwatch
                    key={preset.id}
                    preset={preset}
                    active={activePresetId === preset.id}
                    onClick={() => applyPreset(preset.id)}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowCustom((v) => !v)}
                className="mt-3 self-start font-display text-[0.6rem] uppercase tracking-[0.25em] text-[var(--fg-dim)] hover:text-[var(--accent)]"
              >
                {showCustom ? '× Hide custom colors' : '+ Customize colors'}
              </button>
              {showCustom && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Swatch label="BG" value={palette.bg} onChange={(v) => patchPalette({ bg: v })} />
                  <Swatch label="Glow" value={palette.bgGlow} onChange={(v) => patchPalette({ bgGlow: v })} />
                  <Swatch label="Text" value={palette.fg} onChange={(v) => patchPalette({ fg: v })} />
                  <Swatch label="Deep" value={palette.mosaic5} onChange={(v) => patchPalette({ mosaic5: v })} />
                  <Swatch label="Primary" value={palette.mosaic1} onChange={(v) => patchPalette({ mosaic1: v })} />
                  <Swatch label="Secondary" value={palette.mosaic2} onChange={(v) => patchPalette({ mosaic2: v })} />
                  <Swatch label="Tertiary" value={palette.mosaic3} onChange={(v) => patchPalette({ mosaic3: v })} />
                  <Swatch label="Companion" value={palette.mosaic4} onChange={(v) => patchPalette({ mosaic4: v })} />
                </div>
              )}
            </Step>

            {/* ── Live preview ── */}
            <div
              className="theme-wrap relative flex flex-col gap-3 overflow-hidden border border-[var(--rule)] p-4"
              style={previewStyle}
            >
              <span className="font-display text-[0.55rem] uppercase tracking-[0.3em] text-[var(--fg-mute)]">
                Preview
              </span>
              <div className="title-block flex items-center gap-4 border bg-black p-4">
                {logoDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoDataUrl}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover"
                    style={{
                      boxShadow: `0 0 0 2px ${palette.mosaic1}, 0 0 24px -4px ${palette.mosaic1}`,
                    }}
                  />
                ) : null}
                <div className="flex min-w-0 flex-col">
                  <span className="title-line title-line-1 font-display uppercase tracking-[0.04em] text-[var(--fg)]">
                    {name || 'Your name'}
                  </span>
                  <span className="title-line title-line-2 mt-1 inline-block w-fit max-w-full border-t-2 border-[var(--accent)] pt-1 font-display uppercase tracking-[0.14em] text-[var(--accent)]">
                    Scorecard
                  </span>
                </div>
              </div>
              <div className="flex h-3 overflow-hidden">
                {(['mosaic1', 'mosaic2', 'mosaic3', 'mosaic4', 'mosaic5'] as const).map(
                  (k) => (
                    <span
                      key={k}
                      className="flex-1"
                      style={{ background: palette[k] }}
                    />
                  ),
                )}
              </div>
            </div>

            {error && (
              <div className="border border-red-500/60 bg-red-500/10 px-3 py-2 text-[0.7rem] uppercase tracking-[0.2em] text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-[var(--rule)] bg-black/60 px-5 py-3">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              className="border border-red-500/60 bg-red-500/10 px-3 py-2 font-display text-[0.65rem] uppercase tracking-[0.25em] text-red-400 hover:bg-red-500 hover:text-white"
            >
              Delete
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
              className="border border-[var(--accent)] bg-[var(--accent)] px-5 py-2 font-display text-[0.7rem] uppercase tracking-[0.25em] text-[var(--strip-fg)] hover:opacity-90"
            >
              {isEditing ? 'Save' : 'Create'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Step({
  n,
  label,
  children,
}: {
  n: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 font-display text-[0.7rem] uppercase tracking-[0.3em] text-[var(--fg)]">
        <span className="inline-flex h-5 w-5 items-center justify-center border border-[var(--accent)] text-[var(--accent)]">
          {n}
        </span>
        {label}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function PresetSwatch({
  preset,
  active,
  onClick,
}: {
  preset: { id: string; label: string; palette: Palette };
  active: boolean;
  onClick: () => void;
}) {
  const p = preset.palette;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group flex flex-col items-stretch gap-1 border-2 p-1 transition',
        active
          ? 'border-[var(--fg)] shadow-[0_0_0_2px_var(--accent-soft)]'
          : 'border-[var(--rule)] hover:border-[var(--rule-strong)]',
      )}
      title={preset.label}
    >
      <div
        className="flex h-8"
        style={{
          background: `linear-gradient(135deg, ${p.bg} 0%, ${p.mosaic5} 100%)`,
        }}
      >
        <span className="flex-1" style={{ background: p.mosaic1 }} />
        <span className="flex-1" style={{ background: p.mosaic2 }} />
        <span className="flex-1" style={{ background: p.mosaic3 }} />
      </div>
      <span
        className={clsx(
          'text-center font-display text-[0.55rem] uppercase tracking-[0.2em]',
          active ? 'text-[var(--fg)]' : 'text-[var(--fg-dim)]',
        )}
      >
        {preset.label}
      </span>
    </button>
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
          className="h-9 w-10 cursor-pointer border-r border-[var(--rule-strong)] bg-black/60 p-0"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') onChange(v);
          }}
          className="flex-1 min-w-0 bg-black/60 px-2 font-mono text-[0.65rem] text-[var(--fg)] outline-none"
        />
      </div>
    </label>
  );
}

function sameP(a: Palette, b: Palette): boolean {
  return (
    a.bg === b.bg &&
    a.bgGlow === b.bgGlow &&
    a.fg === b.fg &&
    a.mosaic1 === b.mosaic1 &&
    a.mosaic2 === b.mosaic2 &&
    a.mosaic3 === b.mosaic3 &&
    a.mosaic4 === b.mosaic4 &&
    a.mosaic5 === b.mosaic5
  );
}
