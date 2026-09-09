import type { Player, World } from './model';
import { buildSnapshot, type BuildSnapshot } from './build-snapshot';

// Bump when objective, timing, movement or hazard rules change incompatibly.
export const DISASTER_RULES = 2;
export type ChallengeBenchmark = {
  rulesVersion: number;
  elapsedMs: number;
  crewSize: number;
  crewName: string;
};
export type ChallengeRun = {
  rulesVersion: number;
  crewSize: number;
  elapsedMs?: number;
  invalidReason?: string;
};
export function formatChallengeTime(ms: number) {
  return `${(ms / 1000).toFixed(3)}s`;
}

export function beginChallengeRun(world: World, players: Player[]) {
  const p = world.party!;
  if (world.mode !== 'job' || p.format === 'swap') return;
  p.run = { rulesVersion: DISASTER_RULES, crewSize: players.length };
  world.partyPrivate!.runCrew = players.map((v) => v.id);
  const setup = buildSnapshot(world);
  // Keep object identities for secret jobs and supply slots, without player data.
  setup.pieces = world.pieces.map((v) => ({
    id: v.id,
    kind: v.kind,
    x: v.x,
    z: v.z,
    rotation: v.rotation,
    placed: v.placed,
    ...(v.level ? { level: v.level } : {}),
    ...(v.supply ? { supply: true } : {}),
    ...(v.color !== undefined ? { color: v.color } : {}),
    ...(v.physics
      ? {
          physics: {
            y: v.physics.y,
            q: [...v.physics.q],
            v: [...v.physics.v],
            w: [...v.physics.w],
            sleep: v.physics.sleep,
          } as NonNullable<typeof v.physics>,
        }
      : {}),
  }));
  setup.startRules = {
    origin: { ...p.task.origin },
    target: { ...p.task.target },
    angle: p.task.angle,
    missions: players.map((v) => world.partyPrivate!.missions[v.id]?.id ?? -1),
    ...(p.inspection
      ? {
          rainAfter: p.inspection.rainAt - world.started,
          rainDuration: p.inspection.rainUntil - p.inspection.rainAt,
        }
      : {}),
  };
  delete setup.delivery;
  world.challengeSetup = setup;
}

export function invalidateChallengeRun(world: World, reason: string) {
  if (
    world.party?.run &&
    ['building', 'lastCall', 'rescue'].includes(world.party.phase)
  )
    world.party.run.invalidReason ||= reason;
}
export function checkChallengeCrew(
  world: World,
  players: Player[],
  now: number,
) {
  const crew = world.partyPrivate?.runCrew;
  if (!crew) return;
  if (
    crew.length !== players.length ||
    crew.some((id) => !players.some((v) => v.id === id && now - v.seen < 3000))
  )
    invalidateChallengeRun(
      world,
      'The crew changed or a builder disconnected. Retry with the same crew to set a time.',
    );
  if (crew.length > 1 && world.party?.task.solo)
    invalidateChallengeRun(
      world,
      'Solo assistance was used during a crew attempt. Retry together to set a time.',
    );
}
export function finishChallengeRun(world: World, now: number) {
  const p = world.party!;
  if (p.run && !p.run.invalidReason && p.result?.passed)
    p.run.elapsedMs = Math.max(1, Math.round(now - world.started));
}
export function challengeSnapshot(world: World): BuildSnapshot {
  const p = world.party,
    run = p?.run;
  if (
    !p?.result?.passed ||
    !['inspection', 'results'].includes(p.phase) ||
    !world.challengeSetup ||
    !run?.elapsedMs ||
    run.invalidReason ||
    run.rulesVersion !== DISASTER_RULES
  )
    throw new Error(
      'Finish a successful round with an unchanged crew before sharing a time to beat.',
    );
  return {
    ...structuredClone(world.challengeSetup),
    challenge: {
      rulesVersion: DISASTER_RULES,
      elapsedMs: run.elapsedMs,
      crewSize: run.crewSize,
      crewName: p.crewName || 'Our crew',
    },
  };
}
export function challengeOutcome(world: World): string | null {
  const p = world.party,
    benchmark = p?.challenge;
  if (!benchmark || !p?.result) return null;
  if (p.run?.invalidReason) return p.run.invalidReason;
  if (!p.result.passed || !p.run?.elapsedMs)
    return 'The customer has not approved this attempt. Retry the challenge!';
  const delta = p.run.elapsedMs - benchmark.elapsedMs;
  return delta === 0
    ? 'An exact tie. Settle it with a rematch!'
    : delta < 0
      ? `You beat ${benchmark.crewName} by ${formatChallengeTime(-delta)}!`
      : `${formatChallengeTime(delta)} behind ${benchmark.crewName}. One more try?`;
}
