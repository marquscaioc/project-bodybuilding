import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { FanCardSync } from '@/components/FanCardSync';
import { FanSessionControls } from '@/components/FanSessionControls';
import { ScorecardPage } from '@/components/ScorecardPage';
import { ShowPhotosSync } from '@/components/ShowPhotosSync';
import { FAN_COOKIE, hasExpired, verifyFanToken } from '@/lib/fanAuth';
import { SHOW_ID } from '@/lib/show';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function FanScorecardPage() {
  const cookieStore = await cookies();
  const cardId = await verifyFanToken(cookieStore.get(FAN_COOKIE)?.value);
  if (!cardId) redirect('/');

  const admin = getSupabaseAdmin();
  const { data: card } = await admin
    .from('fan_scorecards')
    .select('id, invite_id, display_name')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) redirect('/');

  const { data: invite } = await admin
    .from('superchat_invites')
    .select('status, expires_at')
    .eq('id', card.invite_id)
    .eq('status', 'claimed')
    .maybeSingle();
  if (!invite || hasExpired(invite.expires_at)) redirect('/');

  return (
    <>
      <ScorecardPage
        judgeId={`fan:${card.id}`}
        themeClass="theme-superchat"
        brand={`${card.display_name} · Superchat`}
        brandLine1="Superchat"
        brandLine2="Scorecard"
        showThemeNav={false}
        photosReadOnly
        sync={
          <>
            <FanCardSync />
            <ShowPhotosSync showCode={SHOW_ID} isHost={false} />
          </>
        }
      />
      <FanSessionControls displayName={card.display_name} />
    </>
  );
}
