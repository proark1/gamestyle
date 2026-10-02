import { isGame, type Game } from '../games/identity';
let active: { game: Game; owner: symbol } | null = null;
const listeners = new Set<() => void>();
const publish = () => {
  for (const listener of listeners) listener();
};
export const diagnosticGameSnapshot = () => active?.game ?? null;
export const serverDiagnosticGameSnapshot = () => null;
export function subscribeDiagnosticGame(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** A retiring embedded game cannot clear the next game's diagnostics. */
export function activateDiagnosticGame(game: string) {
  if (!isGame(game)) return () => {};
  const owner = Symbol(game);
  active = { game, owner };
  publish();
  return () => {
    if (active?.owner === owner) {
      active = null;
      publish();
    }
  };
}
