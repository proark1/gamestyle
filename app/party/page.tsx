import PartyClient from './PartyClient';

export const metadata = {
  title: 'Party Mode — Jumbleyard',
  description:
    '4-Player Party Mode: assemble your crew in the waiting room and battle across 6 random mini-games for the championship crown!',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const { room } = await searchParams;
  return <PartyClient initialCode={room} />;
}
