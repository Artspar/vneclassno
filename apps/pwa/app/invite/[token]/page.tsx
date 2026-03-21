import InviteFlow from '../../_components/invite-flow';

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ childId?: string }>;
}) {
  const { token } = await params;
  const search = (await searchParams) ?? {};

  return (
    <main>
      <InviteFlow token={token} linkedChildId={search.childId} />
    </main>
  );
}
