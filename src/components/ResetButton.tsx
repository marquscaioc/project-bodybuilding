'use client';

import { useScorecard } from '@/lib/store';
import { RotateCcw } from 'lucide-react';

export function ResetButton() {
  const reset = useScorecard((s) => s.reset);
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm('Clear all scores? Athlete names stay.')) reset();
      }}
      className="control-button control-button-quiet"
    >
      <RotateCcw size={14} />
      Clear calls
    </button>
  );
}
