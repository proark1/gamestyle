import { notFound } from 'next/navigation';
import { getBinding } from '@/db/index';
import { readBuild } from '@/games/chaos/build-storage';
import { SavedBuildPage } from '@/games/chaos/SavedBuildPage';
import type { Metadata } from 'next';
import { formatChallengeTime } from '@/games/chaos/disaster-challenge';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const saved = await readBuild(getBinding(), (await params).id);
  if (!saved) return { title: 'Build not found — PERMIT PENDING' };
  const c = saved.build.challenge;
  const title = c
    ? `Beat ${formatChallengeTime(c.elapsedMs)} — PERMIT PENDING`
    : `${saved.title} — PERMIT PENDING`;
  const description = c
    ? `${c.crewName} passed with ${c.crewSize} builders. Can your crew beat the same starting build and job?`
    : `Explore or remix ${saved.author}’s saved build with your friends.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const saved = await readBuild(getBinding(), (await params).id);
  if (!saved) notFound();
  return <SavedBuildPage saved={saved} />;
}
