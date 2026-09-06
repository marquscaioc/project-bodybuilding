'use client';

import { Download } from 'lucide-react';
import { useState, type RefObject } from 'react';

export function ExportButton({
  targetRef,
}: {
  targetRef: RefObject<HTMLDivElement | null>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!targetRef.current) return;
        setBusy(true);
        try {
          const { toPng } = await import('html-to-image');
          const dataUrl = await toPng(targetRef.current, {
            cacheBust: true,
            pixelRatio: 2,
            backgroundColor: '#0a0a0a',
          });
          const a = document.createElement('a');
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          a.download = `project-bodybuilding-${ts}.png`;
          a.href = dataUrl;
          a.click();
        } finally {
          setBusy(false);
        }
      }}
      className="control-button control-button-primary"
    >
      <Download size={14} />
      {busy ? 'Rendering…' : 'Export PNG'}
    </button>
  );
}
