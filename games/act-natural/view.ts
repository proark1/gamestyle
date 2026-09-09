import { farmerSees, revealedToFarmer } from './visibility';
import { distance, farmMode, type FarmView, type FarmWorld } from './types';

export function privateFarmView(w: FarmWorld, id: string): FarmView {
  const player = w.players.find((p) => p.id === id);
  const farmer = id === w.farmerId;
  const restricted = farmer && farmMode(w) === 'human' && w.phase === 'playing';
  const ownCow = w.cows.find((c) => c.id === player?.cowId);
  const listener = farmer ? w.farmer : ownCow;
  return {
    mode: farmMode(w),
    phase: w.phase,
    clock: w.clock,
    started: w.started,
    round: w.round,
    farmer: { ...w.farmer },
    cows: w.cows
      .filter((c) => !restricted || revealedToFarmer(w, c))
      .map((c) => ({
        id: c.id,
        x: c.x,
        z: c.z,
        angle: c.angle,
        grazing: c.grazing,
        moving: c.moving,
        captured: c.captured,
        escaped: c.escaped,
        checkedUntil: c.checkedUntil,
        shockedAt: c.shockedAt,
        carrying:
          c.id === player?.cowId || c.carrying === 'ladder' ? c.carrying : null,
        task: c.id === player?.cowId ? c.task : 0,
        interacting:
          !!c.task ||
          (c.interactedAt !== undefined && w.clock - c.interactedAt < 800),
      })),
    items: w.items
      .filter(
        (item) =>
          item.holder === ownCow?.id ||
          (!item.holder &&
            !item.delivered &&
            (!restricted || farmerSees(w, item))),
      )
      .map((item) => ({
        ...item,
        holder: item.holder === ownCow?.id ? item.holder : null,
      })),
    herd: w.herd,
    herdTarget: { ...w.herdTarget },
    cueUntil: w.cueUntil,
    inspections: w.inspections,
    powerOff: w.powerOff,
    keysDelivered: w.keysDelivered,
    ladderPlaced: w.ladderPlaced,
    events: w.events.map((e) => ({ ...e })),
    practice: w.practice,
    clues: (w.clues ?? [])
      .filter(
        (clue) =>
          listener &&
          w.clock - clue.clock <= 2000 &&
          distance(listener, clue) <= 5,
      )
      .map((clue) => ({ ...clue })),
    panelAudible:
      !!listener &&
      distance(listener, { x: -9, z: 2 }) < 5 &&
      w.cows.some((c) => c.task > 0 && !c.captured && !c.escaped),
    players: w.players.map((p) => {
      const cow = w.cows.find((c) => c.id === p.cowId);
      return {
        ...(p.bot ? { bot: true as const } : {}),
        id: p.id,
        name: p.name,
        role: p.id === w.farmerId ? 'farmer' : 'cow',
        status: cow?.captured ? 'caught' : cow?.escaped ? 'escaped' : 'ready',
      };
    }),
  };
}
