'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { LiveVoteChoice } from '@/lib/types/db';

type VoteRowResult = {
  id: string;
  label: string;
  type: 'pose' | 'category';
  total: number;
  votesA: number;
  votesB: number;
  ties: number;
  averageA: number;
  averageB: number;
  distribution: Record<LiveVoteChoice, number>;
};

type VoteSnapshot = {
  matchup: { key: string; athleteA: string; athleteB: string };
  participants: number;
  averageA: number;
  averageB: number;
  rows: VoteRowResult[];
  me: { username: string; votes: Record<string, LiveVoteChoice> } | null;
};

const USERNAME_KEY = 'pbb-live-vote-username';

export function LiveVote() {
  const [data, setData] = useState<VoteSnapshot | null>(null);
  const [username, setUsername] = useState('');
  const [draftName, setDraftName] = useState('');
  const [votes, setVotes] = useState<Record<string, LiveVoteChoice>>({});
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [error, setError] = useState('');
  const initialized = useRef(false);
  const matchupKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/live-vote', { cache: 'no-store' });
    if (!response.ok) throw new Error('Live vote is temporarily unavailable.');
    const snapshot = await response.json() as VoteSnapshot;
    setData(snapshot);

    if (matchupKey.current && matchupKey.current !== snapshot.matchup.key) {
      setVotes(snapshot.me?.votes ?? {});
    }
    matchupKey.current = snapshot.matchup.key;

    if (!initialized.current) {
      initialized.current = true;
      const remembered = window.localStorage.getItem(USERNAME_KEY) ?? '';
      const currentName = snapshot.me?.username ?? remembered;
      setDraftName(currentName);
      if (snapshot.me) {
        setUsername(snapshot.me.username);
        setVotes(snapshot.me.votes);
        setJoined(true);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        await load();
        if (!cancelled) setError('');
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load votes.');
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [load]);

  async function saveBallot(nextName: string, nextVotes: Record<string, LiveVoteChoice>) {
    const response = await fetch('/api/live-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nextName, votes: nextVotes }),
    });
    const payload = await response.json() as VoteSnapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? 'Could not save your vote.');
    setData(payload);
  }

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = draftName.trim().replace(/\s+/g, ' ');
    if (nextName.length < 2 || nextName.length > 32) {
      setError('Use a username between 2 and 32 characters.');
      return;
    }
    setJoining(true);
    setError('');
    try {
      await saveBallot(nextName, votes);
      window.localStorage.setItem(USERNAME_KEY, nextName);
      setUsername(nextName);
      setJoined(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not enter the live vote.');
    } finally {
      setJoining(false);
    }
  }

  async function choose(rowId: string, choice: LiveVoteChoice) {
    if (!joined || savingRow) return;
    const previousVotes = votes;
    const nextVotes = { ...previousVotes, [rowId]: choice };
    setVotes(nextVotes);
    setSavingRow(rowId);
    setError('');
    try {
      await saveBallot(username, nextVotes);
    } catch (reason) {
      setVotes(previousVotes);
      setError(reason instanceof Error ? reason.message : 'Could not save your vote.');
    } finally {
      setSavingRow(null);
    }
  }

  const completed = Object.keys(votes).length;

  if (!data) {
    return (
      <section className="live-vote-loading" aria-live="polite">
        <span className="home-live-dot" /> Connecting to the live vote…
        {error && <p>{error}</p>}
      </section>
    );
  }

  return (
    <div className="live-vote-shell">
      <section className="live-vote-hero" aria-labelledby="live-vote-title">
        <div>
          <p className="live-vote-kicker"><span /> The crowd decides</p>
          <h1 id="live-vote-title">CALL<br />THE POSES.</h1>
        </div>
        <div className="live-vote-matchup" aria-label={`${data.matchup.athleteA} versus ${data.matchup.athleteB}`}>
          <VoteAthlete name={data.matchup.athleteA} score={data.averageA} side="A" />
          <div className="live-vote-versus">VS</div>
          <VoteAthlete name={data.matchup.athleteB} score={data.averageB} side="B" />
          <div className="live-vote-overall-bar" aria-hidden="true">
            <span style={{ width: `${data.averageA}%` }} />
          </div>
          <p>{data.participants} {data.participants === 1 ? 'voter' : 'voters'} on this matchup</p>
        </div>
      </section>

      {!joined ? (
        <section className="live-vote-login" aria-labelledby="vote-login-title">
          <div>
            <span>NO ACCOUNT. NO APPROVAL.</span>
            <h2 id="vote-login-title">Enter the live room</h2>
            <p>Pick a username and your ballot opens instantly.</p>
          </div>
          <form onSubmit={join}>
            <label htmlFor="vote-username">Username</label>
            <div>
              <input
                id="vote-username"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                minLength={2}
                maxLength={32}
                autoComplete="nickname"
                placeholder="Your YouTube name"
                autoFocus
              />
              <button type="submit" disabled={joining}>{joining ? 'Entering…' : 'Vote now'}</button>
            </div>
          </form>
        </section>
      ) : (
        <section id="live-ballot" className="live-vote-ballot" aria-label="Live voting ballot">
          <div className="live-vote-ballot-head">
            <div>
              <span>Voting as <strong>{username}</strong></span>
              <h2>Your live scorecard</h2>
            </div>
            <div className="live-vote-progress">
              <strong>{String(completed).padStart(2, '0')}</strong>
              <span>of 12 called</span>
            </div>
            <button type="button" onClick={() => { setDraftName(username); setJoined(false); }}>
              Change username
            </button>
          </div>

          {error && <p className="live-vote-error" role="alert">{error}</p>}
          <VoteGroup
            title="Mandatory poses"
            index="01"
            rows={data.rows.filter((row) => row.type === 'pose')}
            athleteA={data.matchup.athleteA}
            athleteB={data.matchup.athleteB}
            votes={votes}
            savingRow={savingRow}
            onChoose={choose}
          />
          <VoteGroup
            title="Physique categories"
            index="02"
            rows={data.rows.filter((row) => row.type === 'category')}
            athleteA={data.matchup.athleteA}
            athleteB={data.matchup.athleteB}
            votes={votes}
            savingRow={savingRow}
            onChoose={choose}
          />
        </section>
      )}
    </div>
  );
}

function VoteAthlete({ name, score, side }: { name: string; score: number; side: 'A' | 'B' }) {
  return (
    <div className={`live-vote-athlete is-${side.toLowerCase()}`}>
      <span>Athlete {side}</span>
      <strong>{name}</strong>
      <em>{score.toFixed(1)}</em>
      <small>Crowd average</small>
    </div>
  );
}

function VoteGroup({
  title,
  index,
  rows,
  athleteA,
  athleteB,
  votes,
  savingRow,
  onChoose,
}: {
  title: string;
  index: string;
  rows: VoteRowResult[];
  athleteA: string;
  athleteB: string;
  votes: Record<string, LiveVoteChoice>;
  savingRow: string | null;
  onChoose: (rowId: string, choice: LiveVoteChoice) => void;
}) {
  return (
    <section className="live-vote-group">
      <header><span>{index}</span><h3>{title}</h3><small>Winner + 1–4 point margin · results update live</small></header>
      <div className="live-vote-rows">
        {rows.map((row) => {
          const selected = votes[row.id];
          return (
            <article key={row.id} className="live-vote-row">
              <div className="live-vote-row-label">
                <span>{row.id}</span>
                <strong>{row.label}</strong>
                <small>{row.total} {row.total === 1 ? 'vote' : 'votes'}</small>
              </div>
              <div className="live-vote-choices" aria-label={`Point margin for ${row.label}`}>
                <MarginSide
                  side="A"
                  athlete={athleteA}
                  selected={selected}
                  distribution={row.distribution}
                  disabled={savingRow !== null}
                  onChoose={(choice) => onChoose(row.id, choice)}
                />
                <button
                  type="button"
                  className={`live-vote-tie ${selected === 'tie' ? 'is-selected' : ''}`}
                  aria-pressed={selected === 'tie'}
                  disabled={savingRow !== null}
                  onClick={() => onChoose(row.id, 'tie')}
                >
                  <span>Tie</span><strong>{row.distribution.tie}</strong>
                </button>
                <MarginSide
                  side="B"
                  athlete={athleteB}
                  selected={selected}
                  distribution={row.distribution}
                  disabled={savingRow !== null}
                  onChoose={(choice) => onChoose(row.id, choice)}
                />
              </div>
              <div className="live-vote-result">
                <div aria-hidden="true"><span style={{ width: `${row.averageA}%` }} /></div>
                <p>
                  <strong>{row.votesA} {row.votesA === 1 ? 'vote' : 'votes'} · {row.averageA.toFixed(1)}</strong>
                  <span>{row.ties} tied · crowd average</span>
                  <strong>{row.averageB.toFixed(1)} · {row.votesB} {row.votesB === 1 ? 'vote' : 'votes'}</strong>
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const MARGINS = [1, 2, 3, 4] as const;

function MarginSide({
  side,
  athlete,
  selected,
  distribution,
  disabled,
  onChoose,
}: {
  side: 'A' | 'B';
  athlete: string;
  selected: LiveVoteChoice | undefined;
  distribution: Record<LiveVoteChoice, number>;
  disabled: boolean;
  onChoose: (choice: LiveVoteChoice) => void;
}) {
  return (
    <div className={`live-vote-margin-side is-${side.toLowerCase()}`}>
      <span title={athlete}>{athlete}</span>
      <div>
        {MARGINS.map((margin) => {
          const choice = `${side}${margin}` as LiveVoteChoice;
          const active = selected === choice;
          return (
            <button
              key={choice}
              type="button"
              aria-label={`${athlete} by ${margin} ${margin === 1 ? 'point' : 'points'}`}
              aria-pressed={active}
              className={active ? 'is-selected' : undefined}
              disabled={disabled}
              onClick={() => onChoose(choice)}
            >
              <b>{margin}</b><small>{distribution[choice]}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
