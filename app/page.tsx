import { redirect } from 'next/navigation';
import CollectionClient from './CollectionClient';
import { createEnhancedCollectionOrder } from './landing-enhanced/order';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; raum?: string }>;
}) {
  const { room, raum } = await searchParams;
  if (room && /^[A-Z2-9]{6}$/i.test(room))
    redirect(`/stack-or-sink?room=${encodeURIComponent(room)}`);
  if (raum && /^[A-Z2-9]{6}$/i.test(raum))
    redirect(`/chaos?raum=${encodeURIComponent(raum)}`);
  const order = createEnhancedCollectionOrder();
  return <CollectionClient order={order} />;
}
