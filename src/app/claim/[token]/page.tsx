import { SuperchatClaimPanel } from '@/components/SuperchatClaimPanel';

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SuperchatClaimPanel token={token} />;
}
