'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clipboard,
  ExternalLink,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Unlock,
  UserCheck,
  X,
} from 'lucide-react';
import { HOST_SLUG } from '@/lib/show';
import { displayScores } from '@/lib/scoring';
import type { FanScorecardRow, SuperchatClaimRow, SuperchatInviteRow } from '@/lib/types/db';

type DeskPayload = {
  invites: SuperchatInviteRow[];
  claims: SuperchatClaimRow[];
  cards: FanScorecardRow[];
};

export function SuperchatHostConsole() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<DeskPayload>({ invites: [], claims: [], cards: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/show-session', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<{ principal: string }> : null)
      .then((session) => {
        if (cancelled) return;
        if (session?.principal !== HOST_SLUG) {
          router.replace('/?access=host');
          return;
        }
        setAuthed(true);
      })
      .catch(() => router.replace('/?access=host'));
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/host/superchats', { cache: 'no-store' });
        if (cancelled) return;
        if (!response.ok) throw new Error('Could not load the access desk.');
        setData(await response.json() as DeskPayload);
        setError('');
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Connection failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(load, 2_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authed]);

  const cardsByInvite = useMemo(
    () => new Map(data.cards.map((card) => [card.invite_id, card])),
    [data.cards],
  );
  const claimsByInvite = useMemo(() => {
    const grouped = new Map<string, SuperchatClaimRow[]>();
    for (const claim of data.claims) {
      grouped.set(claim.invite_id, [...(grouped.get(claim.invite_id) ?? []), claim]);
    }
    return grouped;
  }, [data.claims]);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rawAmount = String(form.get('amount') ?? '0').replace(',', '.');
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/host/superchats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: String(form.get('displayName') ?? ''),
          amount: Number(rawAmount),
          currency: String(form.get('currency') ?? 'BRL'),
          note: String(form.get('note') ?? ''),
          expiresInHours: Number(form.get('expiresInHours') ?? 12),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not create invitation.');
      formElement.reset();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create invitation.');
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    const response = await fetch('/api/host/superchats', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not refresh access desk.');
    setData(await response.json() as DeskPayload);
  }

  async function act(payload: Record<string, string>) {
    setError('');
    try {
      const response = await fetch('/api/host/superchats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Action failed.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action failed.');
    }
  }

  async function copyInvite(invite: SuperchatInviteRow) {
    const url = `${window.location.origin}/claim/${invite.claim_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(invite.id);
    window.setTimeout(() => setCopied(''), 1_800);
  }

  if (!authed) return null;

  const pendingCount = data.claims.filter((claim) => claim.status === 'pending').length;
  const activeCount = data.invites.filter((invite) => invite.status !== 'closed').length;

  return (
    <main className="superchat-admin theme-superchat">
      <a href="#create-superchat" className="skip-link">Skip to create invitation</a>
      <header className="superchat-admin-header">
        <div>
          <span className="superchat-admin-kicker"><span className="bb-live-dot" aria-hidden /> Manual access desk</span>
          <h1>Super Chat scorecards</h1>
        </div>
        <div className="superchat-admin-head-actions">
          <span>{pendingCount} pending · {activeCount} open</span>
          <Link href="/host">← Host console</Link>
        </div>
      </header>

      <section className="superchat-admin-layout">
        <form id="create-superchat" className="superchat-create" onSubmit={createInvite}>
          <div className="superchat-panel-label"><Plus size={14} aria-hidden /> New invitation</div>
          <h2>Create viewer card</h2>
          <p>Copy the generated link into YouTube chat. Access still requires your approval.</p>

          <label>
            YouTube display name
            <input name="displayName" required maxLength={80} placeholder="@supporter" autoComplete="off" />
          </label>

          <div className="superchat-form-row">
            <label>
              Amount
              <input name="amount" type="number" min="0" step="0.01" defaultValue="0" required />
            </label>
            <label>
              Currency
              <select name="currency" defaultValue="BRL">
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </label>
          </div>

          <label>
            Note <span>optional</span>
            <textarea name="note" maxLength={240} rows={3} placeholder="Message or context" />
          </label>

          <label>
            Link expires in
            <select name="expiresInHours" defaultValue="12">
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
            </select>
          </label>

          <button className="superchat-create-button" type="submit" disabled={saving}>
            <Plus size={17} aria-hidden /> {saving ? 'Creating…' : 'Create scorecard link'}
          </button>
        </form>

        <section className="superchat-queue" aria-labelledby="queue-title">
          <div className="superchat-queue-heading">
            <div>
              <span>Live queue</span>
              <h2 id="queue-title">Access requests</h2>
            </div>
            <button type="button" onClick={() => void refresh()} aria-label="Refresh queue">
              <RefreshCw size={17} aria-hidden />
            </button>
          </div>

          {error && <p className="superchat-error" role="alert">{error}</p>}
          {loading ? (
            <p className="superchat-empty">Loading invitations…</p>
          ) : data.invites.length === 0 ? (
            <p className="superchat-empty">No Super Chat scorecards yet.</p>
          ) : (
            <div className="superchat-invite-list">
              {data.invites.map((invite) => {
                const claims = claimsByInvite.get(invite.id) ?? [];
                const card = cardsByInvite.get(invite.id);
                const scored = card?.rows.filter((row) => row.winner !== null).length ?? 0;
                const scores = card && scored > 0 ? displayScores(card.rows) : null;
                const expired = new Date(invite.expires_at).getTime() <= Date.now();
                return (
                  <article className="superchat-invite" key={invite.id}>
                    <div className="superchat-invite-top">
                      <div>
                        <span className={`superchat-status is-${expired ? 'closed' : invite.status}`}>
                          {expired ? 'expired' : invite.status}
                        </span>
                        <h3>{invite.display_name}</h3>
                        <p>
                          {formatAmount(invite.amount, invite.currency)} · {scored}/12 calls
                          {scores ? ` · A ${scores.a.toFixed(1)} / B ${scores.b.toFixed(1)}` : ''}
                        </p>
                      </div>
                      <div className="superchat-invite-actions">
                        <button type="button" onClick={() => void copyInvite(invite)} title="Copy invitation link">
                          {copied === invite.id ? <Check size={16} aria-hidden /> : <Clipboard size={16} aria-hidden />}
                          {copied === invite.id ? 'Copied' : 'Copy link'}
                        </button>
                        <Link href={`/claim/${invite.claim_token}`} target="_blank" rel="noreferrer" title="Open claim page">
                          <ExternalLink size={16} aria-hidden />
                        </Link>
                        {invite.status === 'closed' ? (
                          <button type="button" onClick={() => void act({ action: 'reopen', inviteId: invite.id })} title="Reopen scorecard">
                            <Unlock size={16} aria-hidden />
                          </button>
                        ) : (
                          <button type="button" onClick={() => void act({ action: 'close', inviteId: invite.id })} title="Close scorecard">
                            <Lock size={16} aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>

                    {invite.note && <p className="superchat-note">“{invite.note}”</p>}

                    <div className="superchat-claims">
                      {claims.length === 0 ? (
                        <div className="superchat-no-claim"><ShieldCheck size={15} aria-hidden /> Link created — waiting for viewer</div>
                      ) : claims.map((claim) => (
                        <div className={`superchat-claim is-${claim.status}`} key={claim.id}>
                          <div>
                            <span>{claim.status === 'pending' ? 'Verify this chat code' : claim.status}</span>
                            <strong>{claim.verification_code}</strong>
                          </div>
                          {claim.status === 'pending' && invite.status === 'active' && !expired && (
                            <div className="superchat-claim-actions">
                              <button type="button" className="approve" onClick={() => void act({ action: 'approve', claimId: claim.id })}>
                                <UserCheck size={16} aria-hidden /> Approve
                              </button>
                              <button type="button" onClick={() => void act({ action: 'reject', claimId: claim.id })}>
                                <X size={16} aria-hidden /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}
