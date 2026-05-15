import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { ScorecardPage } from '@/components/ScorecardPage';
import { CloudScorecardProvider } from '@/components/CloudScorecardProvider';
import { VisibilityToggle } from '@/components/VisibilityToggle';
import { paletteToStyle } from '@/lib/customJudges';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  // Defensive: if Supabase isn't configured / down, send the user to /login
  // rather than letting the page crash with a 500.
  let user;
  let profile;
  try {
    const supabase = await getSupabaseServer();
    const userResult = await supabase.auth.getUser();
    user = userResult.data.user;
    if (!user) redirect('/login?next=/me');
    const profileResult = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    profile = profileResult.data;
  } catch (err) {
    // `redirect()` throws internally — let it propagate.
    if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    console.warn('me page supabase fetch failed', err);
    redirect('/login?next=/me');
  }

  // Fall back to safe defaults if the profile trigger somehow didn't fire.
  const display = profile?.display_name || user.email?.split('@')[0] || 'Judge';
  const brandLine1 = profile?.brand_line_1 || display;
  const brandLine2 = profile?.brand_line_2 || 'Scorecard';

  const themeStyle = paletteToStyle({
    id: user.id,
    name: display,
    brandLine1,
    brandLine2,
    createdAt: 0,
    bg: profile?.bg ?? '#0a0a0a',
    bgGlow: profile?.bg_glow ?? '#181818',
    fg: profile?.fg ?? '#f5f5f5',
    mosaic1: profile?.mosaic_1 ?? '#e10600',
    mosaic2: profile?.mosaic_2 ?? '#ff8a3d',
    mosaic3: profile?.mosaic_3 ?? '#ffc94e',
    mosaic4: profile?.mosaic_4 ?? '#ffaecd',
    mosaic5: profile?.mosaic_5 ?? '#2a0e1c',
    logoDataUrl: profile?.logo_url ?? undefined,
  });

  return (
    <CloudScorecardProvider userId={user.id}>
      <ScorecardPage
        judgeId={`cloud:${user.id}`}
        themeStyle={themeStyle}
        brand={display}
        brandLine1={brandLine1}
        brandLine2={brandLine2}
        logoSrc={profile?.logo_url ?? undefined}
      />
      <CloudControls userId={user.id} email={user.email ?? ''} />
    </CloudScorecardProvider>
  );
}

function CloudControls({ userId, email }: { userId: string; email: string }) {
  return (
    <div
      className="theme-wrap fixed bottom-3 right-3 z-40 flex items-center gap-2 border border-[var(--rule)] bg-black/80 px-3 py-2 backdrop-blur"
    >
      <span className="font-display text-[0.6rem] uppercase tracking-[0.3em] text-[var(--fg-mute)]">
        {email}
      </span>
      <VisibilityToggle userId={userId} />
      <Link
        href="/live"
        className="border border-[var(--rule-strong)] bg-transparent px-3 py-1 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        Live judges
      </Link>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="border border-[var(--rule)] bg-transparent px-3 py-1 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-mute)] transition hover:text-[var(--fg)]"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
