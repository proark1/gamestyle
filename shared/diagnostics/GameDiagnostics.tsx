'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { isGame } from '../games/identity';
import { startDiagnostics } from './collector';
import {
  diagnosticGameSnapshot,
  serverDiagnosticGameSnapshot,
  subscribeDiagnosticGame,
} from './game-context';

export default function GameDiagnostics() {
  const pathname = usePathname();
  const active = useSyncExternalStore(
    subscribeDiagnosticGame,
    diagnosticGameSnapshot,
    serverDiagnosticGameSnapshot,
  );
  const slug = pathname?.split('/').filter(Boolean)[0];
  const game =
    pathname?.split('/').filter(Boolean).length === 1 && isGame(slug)
      ? slug
      : pathname === '/party'
        ? active
        : null;
  const initial = useRef(true);
  useEffect(() => {
    let stop: (() => void) | undefined;
    const timer = setTimeout(() => {
      const first = initial.current;
      initial.current = false;
      if (game) stop = startDiagnostics(game, first);
    }, 0);
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, [game, pathname]);
  return null;
}
