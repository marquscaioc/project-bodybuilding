'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Check, Copy, Radio, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import channelLogo from '../../public/logos/project-bodybuilding.jpg';

type ClaimData = {
  invite?: {
    displayName: string;
    amount: number;
    currency: string;
    status: 'active' | 'claimed' | 'closed';
    expiresAt: string;
  };
  claim?: {
    status: 'pending' | 'approved' | 'rejected';
    verificationCode: string;
  } | null;
  expired?: boolean;
  scorecardPath?: string;
  error?: string;
};

export function SuperchatClaimPanel({ token }: { token: string }) {
  const router = useRouter();
  const [data, setData] = useState<ClaimData | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [polling, setPolling] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const response = await fetch(`/api/superchat/claim/${token}`, { cache: 'no-store' });
        const next = await response.json() as ClaimData;
        if (cancelled) return;
        setData(next);
        if (response.ok && next.scorecardPath) {
          router.replace(next.scorecardPath);
          return;
        }
        if (response.ok && next.claim?.status === 'pending') {
          timer = setTimeout(load, 2_000);
        }
      } catch {
        if (!cancelled) timer = setTimeout(load, 3_000);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [polling, router, token]);

  async function requestAccess() {
    setRequesting(true);
    try {
      const response = await fetch(`/api/superchat/claim/${token}`, { method: 'POST' });
      const next = await response.json() as ClaimData;
      setData((current) => ({ ...current, ...next }));
      if (response.ok) setPolling((value) => value + 1);
    } catch {
      setData((current) => ({ ...current, error: 'Connection failed. Try again.' }));
    } finally {
      setRequesting(false);
    }
  }

  async function copyCode() {
    const code = data?.claim?.verificationCode;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  const invite = data?.invite;
  const unavailable = Boolean(data?.expired || invite?.status === 'closed' || (invite?.status === 'claimed' && !data?.claim));
  const pending = data?.claim?.status === 'pending';
  const rejected = data?.claim?.status === 'rejected';

  return (
    <main className="claim-page theme-superchat">
      <div className="claim-grid" aria-hidden="true" />
      <section className="claim-card" aria-labelledby="claim-title">
        <header className="claim-brand">
          <Image src={channelLogo} alt="" width={46} height={46} priority />
          <div>
            <span>PROJECT: BODYBUILDING</span>
            <strong>SUPERCHAT ACCESS</strong>
          </div>
        </header>

        {!data ? (
          <div className="claim-loading" aria-live="polite">Checking invitation…</div>
        ) : data.error && !invite ? (
          <ClaimMessage title="Invitation unavailable" body={data.error} />
        ) : unavailable ? (
          <ClaimMessage title="Access closed" body="This scorecard invitation has expired or was already claimed." />
        ) : rejected ? (
          <ClaimMessage title="Request not approved" body="Ask Dylan for a new invitation if this was a mistake." />
        ) : pending ? (
          <>
            <div className="claim-step-label"><Radio size={14} aria-hidden /> Waiting for Dylan</div>
            <h1 id="claim-title">Verify in the live chat.</h1>
            <p className="claim-lead">
              Post this exact code from the YouTube account that sent the Super Chat. Dylan will approve it manually.
            </p>
            <button type="button" className="claim-code" onClick={copyCode} aria-label="Copy verification code">
              <span>{data.claim?.verificationCode}</span>
              {copied ? <Check size={20} aria-hidden /> : <Copy size={20} aria-hidden />}
            </button>
            <div className="claim-waiting" role="status">
              <span className="bb-live-dot" aria-hidden /> Approval pending — this page updates automatically
            </div>
          </>
        ) : (
          <>
            <div className="claim-step-label"><ShieldCheck size={14} aria-hidden /> Private invitation</div>
            <h1 id="claim-title">Your scorecard is ready.</h1>
            <p className="claim-lead">
              This invitation was created for <strong>{invite?.displayName}</strong>. Request access, verify your code in chat, and wait for Dylan to approve.
            </p>
            {invite && (
              <dl className="claim-receipt">
                <div><dt>Supporter</dt><dd>{invite.displayName}</dd></div>
                <div><dt>Super Chat</dt><dd>{formatAmount(invite.amount, invite.currency)}</dd></div>
              </dl>
            )}
            <button
              type="button"
              className="claim-primary"
              disabled={requesting}
              onClick={requestAccess}
            >
              {requesting ? 'Creating request…' : 'Request my scorecard'}
            </button>
            <p className="claim-privacy">The link alone does not unlock the card. Dylan must approve your browser.</p>
          </>
        )}
      </section>
    </main>
  );
}

function ClaimMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="claim-message" role="alert">
      <span>PROJECT: BODYBUILDING</span>
      <h1 id="claim-title">{title}</h1>
      <p>{body}</p>
    </div>
  );
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}
