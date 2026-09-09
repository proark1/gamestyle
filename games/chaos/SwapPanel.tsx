import type { Snapshot } from './model';
import type { PartyAction } from './party';
import { activeSwapTeam, swapPuzzle } from './swap';
const teamName = (index: number) => (index ? 'Turquoise' : 'Yellow');
export function SwapPanel({
  snapshot: s,
  playerId,
  act,
}: {
  snapshot: Snapshot;
  playerId: string;
  act: (a: PartyAction) => void;
}) {
  const p = s.world.party!,
    swap = p.swap;
  if (!swap) return null;
  const yours = swap.teams.findIndex((team) => team.includes(playerId));
  return (
    <div className="inspection-brief swap-brief">
      <b>BUILD & SWAP · {teamName(yours)} CREW</b>
      <p>
        {swap.teams
          .map(
            (team, n) =>
              `${teamName(n)}: ${team.map((id) => s.players.find((v) => v.id === id)?.name || 'Reconnecting…').join(' + ')}`,
          )
          .join(' / ')}
      </p>
      {swap.pausedAt !== undefined ? (
        <>
          <output>Clock paused · waiting for four builders</output>
          {s.host === playerId && (
            <button onClick={() => act({ type: 'party', op: 'swap-reseat' })}>
              Assign the replacement builder
            </button>
          )}
        </>
      ) : (
        <p className="inspection-clock">
          {Math.max(0, Math.ceil((p.deadline - s.now) / 1000))}s ·{' '}
          {swap.stage === 'design'
            ? 'BUILD YOUR PUZZLE'
            : swap.stage.startsWith('prove')
              ? 'PROVE YOUR ROUTE'
              : 'SWAP & RACE'}
        </p>
      )}
      {swap.stage === 'design' ? (
        <p>
          Build walls and furniture inside your colored plot. Leave room to turn
          a sofa from the front collection lane into the marked bay. You will
          have to prove your own route before the other pair tries it.
        </p>
      ) : (
        swap.stage !== 'finished' && (
          <p>
            {teamName(activeSwapTeam(swap))} crew: carry the sofa through the{' '}
            {teamName(swapPuzzle(swap)).toLowerCase()} plot.{' '}
            {activeSwapTeam(swap) === yours
              ? 'Take one handle each.'
              : 'Watch the other pair. Your turn is next.'}{' '}
            The puzzle stays locked during deliveries.
          </p>
        )
      )}
      <p>
        {swap.verified
          .map(
            (v, n) =>
              `${teamName(n)} route: ${v ? '✓ proven' : 'not yet proven'}`,
          )
          .join(' · ')}
      </p>
    </div>
  );
}
