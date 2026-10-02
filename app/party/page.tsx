import PartyClient from './PartyClient';

export const metadata = {
  title: 'Party Mode — Jumbleyard',
  description:
    'Bring 2–4 friends for a Quick or Classic Party. Play together, choose the next game and celebrate your crew. Solo practice is welcome too.',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const { room } = await searchParams;
  return <PartyClient initialCode={room} />;
}
