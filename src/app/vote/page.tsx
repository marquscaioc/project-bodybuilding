import type { Metadata } from 'next';
import Link from 'next/link';
import { LiveVote } from '@/components/LiveVote';

export const metadata: Metadata = {
  title: 'Live audience vote',
  description: 'Vote live on every pose and category in the current Project: Bodybuilding matchup.',
};

export default function VotePage() {
  return (
    <main className="live-vote-page">
      <a href="#live-ballot" className="skip-link">Skip to ballot</a>
      <header className="live-vote-header">
        <Link href="/" aria-label="Back to Project: Bodybuilding home">
          PROJECT: <strong>BODYBUILDING</strong>
        </Link>
        <span><i aria-hidden="true" /> Audience live vote</span>
      </header>
      <LiveVote />
    </main>
  );
}
