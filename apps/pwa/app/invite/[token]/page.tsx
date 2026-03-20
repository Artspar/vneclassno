import InviteFlow from '../../_components/invite-flow';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main>
      <InviteFlow token={token} />
    </main>
  );
}
