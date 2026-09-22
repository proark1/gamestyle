export type Team = 'red' | 'blue';
export type Style = 'boxer' | 'kickboxer' | 'jiu-jitsu' | 'mma';
export type Input = {
  x: number;
  z: number;
  punch: boolean;
  kick: boolean;
  grapple: boolean;
  guard: boolean;
  dodge: boolean;
  cancel: boolean;
};
export const idleInput = (): Input => ({
  x: 0,
  z: 0,
  punch: false,
  kick: false,
  grapple: false,
  guard: false,
  dodge: false,
  cancel: false,
});
export type Move = 'jab' | 'cross' | 'hook' | 'kick' | 'clinch';
export type Fighter = {
  id: string;
  name: string;
  color: number;
  bot: boolean;
  team: Team;
  seen: number;
  style: Style | null;
  commitment: string;
  revealed: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  health: number;
  stamina: number;
  balance: number;
  down: number;
  input: Input;
  previous: Input;
  attack: number;
  move: Move;
  struck: boolean;
  whiffed: boolean;
  charge: number;
  queuedMove: Move | null;
  queueTime: number;
  cooldown: number;
  dodge: number;
  dodgeCooldown: number;
  guarding: boolean;
  guardAge: number;
  parryCooldown: number;
  counter: number;
  combo: number;
  comboTime: number;
  stagger: number;
  lastHit: number;
  damage: number;
  takedowns: number;
  advances: number;
  knockdowns: number;
  punches: number;
};
export type Grapple = {
  mode: 'clinch' | 'guard' | 'mount';
  top: string;
  age: number;
  progress: number;
  submissionBy: string | null;
  submission: number;
  cooldown: number;
  still: number;
};
export type EventKind =
  | 'punch'
  | 'kick'
  | 'hit'
  | 'block'
  | 'parry'
  | 'counter'
  | 'guard-break'
  | 'miss'
  | 'down'
  | 'clinch'
  | 'takedown'
  | 'escape'
  | 'bridge'
  | 'advance'
  | 'submission'
  | 'bell';
export type FightEvent = {
  move?: Move;
  id: number;
  kind: EventKind;
  x: number;
  z: number;
  team: Team;
  strength: number;
};
export type World = {
  clock: number;
  started: number;
  phase: 'selection' | 'countdown' | 'playing' | 'break' | 'ended';
  time: number;
  phaseTime: number;
  round: number;
  selection: number;
  selectionTime: number;
  winner: Team | 'draw' | null;
  finish: 'KO' | 'Submission' | 'Decision' | null;
  players: Fighter[];
  grapple: Grapple | null;
  events: FightEvent[];
  nextEvent: number;
  tick: number;
  remainder: number;
  botChoices: Record<string, { style: Style; nonce: string }>;
};
export type Snapshot = {
  code: string;
  host: string;
  selfId: string;
  version: number;
  world: World;
};
export const STEP = 1 / 60;
export const CAGE_RADIUS = 5.4;
export const BODY_RADIUS = 0.38;
export const otherTeam = (team: Team): Team =>
  team === 'red' ? 'blue' : 'red';
export function cleanInput(raw: Record<string, unknown>): Input {
  const x =
    typeof raw.x === 'number' && Number.isFinite(raw.x)
      ? Math.max(-1, Math.min(1, raw.x))
      : 0;
  const z =
    typeof raw.z === 'number' && Number.isFinite(raw.z)
      ? Math.max(-1, Math.min(1, raw.z))
      : 0;
  const length = Math.max(1, Math.hypot(x, z));
  return {
    x: x / length,
    z: z / length,
    punch: raw.punch === true,
    kick: raw.kick === true,
    grapple: raw.grapple === true,
    guard: raw.guard === true,
    dodge: raw.dodge === true,
    cancel: raw.cancel === true,
  };
}
