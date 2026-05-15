'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { Side } from '@/types';
import { useScorecard } from '@/lib/store';
import { processPhoto } from '@/lib/processPhoto';
import { classifyOrientation, defaultPoseForOrientation } from '@/lib/poseDetect';
import { POSES } from '@/lib/constants';

type ImportRecord = { side: Side; poseId: string };

/**
 * Try to upgrade a thumbnail URL to its full-size original by stripping
 * the WordPress dimension suffix and -scaled marker. Falls back to the
 * input URL if nothing matches.
 *
 *   photo-300x400.jpg     → photo.jpg
 *   photo-1024x768.jpg    → photo.jpg
 *   photo-scaled.jpg      → photo.jpg
 *   photo-300x400-scaled.jpg → photo.jpg
 */
function stripSizeSuffixes(url: string): string {
  let r = url;
  r = r.replace(/-(\d+)x(\d+)(\.[a-z]+)(\?|#|$)/i, '$3$4');
  r = r.replace(/-scaled(\.[a-z]+)/i, '$1');
  return r;
}

export function ImporterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setPhoto = useScorecard((s) => s.setPhoto);

  const [url, setUrl] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [pageTitle, setPageTitle] = useState<string | undefined>();
  const [resolvedFromViewer, setResolvedFromViewer] = useState(0);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | undefined>();
  const [importing, setImporting] = useState<Record<string, Side | undefined>>({});
  const [imported, setImported] = useState<Record<string, ImportRecord>>({});

  // Reset transient state every time the dialog opens fresh.
  useEffect(() => {
    if (!open) return;
    setError(undefined);
    setImporting({});
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleFetch() {
    if (!url.trim()) return;
    setFetchState('loading');
    setError(undefined);
    setImages([]);
    setPageTitle(undefined);
    try {
      const res = await fetch('/api/scrape-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as {
        images: string[];
        pageTitle?: string;
        resolvedFromViewer?: number;
        error?: string;
      };
      if (data.error) throw new Error(data.error);
      setImages(data.images);
      setPageTitle(data.pageTitle);
      setResolvedFromViewer(data.resolvedFromViewer ?? 0);
      setFetchState('idle');
    } catch (e) {
      setError((e as Error).message);
      setFetchState('error');
    }
  }

  async function handleImport(imgUrl: string, side: Side) {
    setImporting((s) => ({ ...s, [imgUrl]: side }));
    try {
      // Try the largest-possible URL first (strips WordPress -WxH and -scaled
      // suffixes); fall back to the original URL on 404 or proxy error.
      const fullUrl = stripSizeSuffixes(imgUrl);
      let res: Response | null = null;
      if (fullUrl !== imgUrl) {
        const tryRes = await fetch(
          `/api/proxy-image?url=${encodeURIComponent(fullUrl)}`,
        );
        if (tryRes.ok) res = tryRes;
      }
      if (!res) {
        res = await fetch(`/api/proxy-image?url=${encodeURIComponent(imgUrl)}`);
      }
      if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
      const blob = await res.blob();
      const filename = imgUrl.split('/').pop()?.split('?')[0] ?? 'photo.jpg';
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });

      const { cutoutUrl, face, body, pose } = await processPhoto(file);
      const orientation = classifyOrientation(pose);
      const poseId = defaultPoseForOrientation(orientation);

      setPhoto(side, poseId, {
        imageUrl: cutoutUrl,
        face: face ?? undefined,
        body,
        pose: pose ?? undefined,
      });
      setImported((m) => ({ ...m, [imgUrl]: { side, poseId } }));
    } catch (e) {
      console.error('Import failed', e);
      setError(`Import failed: ${(e as Error).message}`);
    } finally {
      setImporting((s) => {
        const next = { ...s };
        delete next[imgUrl];
        return next;
      });
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border border-[var(--rule)] bg-[var(--bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-[var(--rule)] bg-black/60 px-5 py-3">
          <div className="flex flex-col">
            <span className="font-display text-lg uppercase tracking-[0.3em] text-[var(--fg)]">
              Import From Gallery
            </span>
            <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
              Paste any gallery URL · auto-classifies front / side / rear
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-display text-2xl leading-none text-[var(--fg-dim)] hover:text-[var(--accent)]"
            aria-label="Close importer"
          >
            ×
          </button>
        </header>

        <div className="flex flex-col gap-3 border-b border-[var(--rule)] bg-black/40 px-5 py-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFetch();
              }}
              placeholder="https://contests.npcnewsonline.com/…"
              className="flex-1 min-w-[260px] border border-[var(--rule-strong)] bg-black/60 px-3 py-2 font-mono text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={handleFetch}
              disabled={fetchState === 'loading' || !url.trim()}
              className="border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-[0.3em] text-[var(--strip-fg)] transition hover:opacity-90 disabled:opacity-40"
            >
              {fetchState === 'loading' ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
          {pageTitle && (
            <div className="text-[0.7rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
              <span className="text-[var(--fg-mute)]">Page · </span>
              <span className="text-[var(--fg)]">{pageTitle}</span>
              <span className="ml-3 text-[var(--fg-mute)]">{images.length} images</span>
              {resolvedFromViewer > 0 && (
                <span className="ml-3 text-[var(--accent)]">
                  · {resolvedFromViewer} hi-res resolved
                </span>
              )}
            </div>
          )}
          {error && (
            <div className="border border-[var(--accent)]/60 bg-[var(--accent-soft)] px-3 py-2 text-[0.7rem] uppercase tracking-[0.2em] text-[var(--fg)]">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {images.length === 0 && fetchState === 'idle' && !error && (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-[var(--fg-dim)]">
              <span className="font-display text-2xl uppercase tracking-[0.3em] text-[var(--fg-mute)]">
                No gallery loaded
              </span>
              <span className="text-[0.65rem] uppercase tracking-[0.25em]">
                Paste a URL above and click Fetch
              </span>
            </div>
          )}

          {fetchState === 'loading' && (
            <div className="flex h-full items-center justify-center">
              <span className="font-display text-sm uppercase tracking-[0.3em] text-[var(--fg-dim)]">
                Scraping page…
              </span>
            </div>
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((imgUrl) => (
                <Thumbnail
                  key={imgUrl}
                  imgUrl={imgUrl}
                  importing={importing[imgUrl]}
                  imported={imported[imgUrl]}
                  onImport={handleImport}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Thumbnail({
  imgUrl,
  importing,
  imported,
  onImport,
}: {
  imgUrl: string;
  importing: Side | undefined;
  imported: ImportRecord | undefined;
  onImport: (url: string, side: Side) => void;
}) {
  const proxied = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
  const isImporting = !!importing;
  const isImported = !!imported;
  const importedLabel = imported
    ? `${imported.side} · ${POSES.find((p) => p.id === imported.poseId)?.short ?? imported.poseId}`
    : null;

  return (
    <div
      className={clsx(
        'group relative aspect-[3/4] overflow-hidden border border-[var(--rule)] bg-black',
        isImported && 'ring-2 ring-[var(--accent)]',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxied}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />

      {!isImporting && !isImported && (
        <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onImport(imgUrl, 'A')}
            className="flex-1 border border-[var(--side-a)] bg-black/70 px-2 py-1 font-display text-[0.65rem] uppercase tracking-[0.2em] text-[var(--side-a)] hover:bg-[var(--side-a)] hover:text-black"
          >
            → A
          </button>
          <button
            type="button"
            onClick={() => onImport(imgUrl, 'B')}
            className="flex-1 border border-[var(--side-b)] bg-black/70 px-2 py-1 font-display text-[0.65rem] uppercase tracking-[0.2em] text-[var(--side-b)] hover:bg-[var(--side-b)] hover:text-black"
          >
            → B
          </button>
        </div>
      )}

      {isImporting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--fg-mute)] border-t-[var(--accent)]" />
          <span className="font-display text-[0.6rem] uppercase tracking-[0.3em] text-[var(--fg)]">
            Processing → {importing}
          </span>
        </div>
      )}

      {isImported && importedLabel && (
        <div className="absolute right-1 top-1 border border-[var(--accent)] bg-black/80 px-1.5 py-0.5 font-display text-[0.55rem] uppercase tracking-[0.25em] text-[var(--accent)]">
          ✓ {importedLabel}
        </div>
      )}
    </div>
  );
}
