'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { recordAdventureVisit, subscribeAdventure } from './adventure-state';

/** Track arrival, not clicks: opening a game earns a visit stamp. */
export default function AdventureTracker({ slugs }: { slugs: string[] }) {
  const pathname = usePathname();
  useEffect(() => subscribeAdventure(() => {}), []);
  useEffect(() => {
    const slug = pathname?.replace(/^\//, '').replace(/\/$/, '');
    if (slug && slugs.includes(slug)) recordAdventureVisit(slug);
  }, [pathname, slugs]);
  return null;
}
