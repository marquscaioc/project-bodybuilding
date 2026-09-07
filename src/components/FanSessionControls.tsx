'use client';

import { useRouter } from 'next/navigation';

export function FanSessionControls({ displayName }: { displayName: string }) {
  const router = useRouter();

  async function leave() {
    await fetch('/api/fan-scorecard', { method: 'DELETE' }).catch(() => undefined);
    router.replace('/');
  }

  return (
    <div className="theme-superchat fan-session-controls">
      <span title={displayName}>{displayName}</span>
      <button type="button" onClick={leave}>Leave card</button>
    </div>
  );
}
