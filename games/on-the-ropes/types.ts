export type Team = 'red' | 'blue';
export type Input = {
  x: number;
  z: number;
  punch: boolean;
  guard: boolean;
  dodge: boolean;
  tag: boolean;
  assist: boolean;
  cancel: boolean;
};
export const idleInput = (): Input => ({
  x: 0,
  z: 0,
  punch: false,
  guard: false,
  dodge: false,
  tag: false,
  assist: false,
  cancel: false,
});
export type Boxer = {
  id: string;
  name: string;
  color: number;
  bot: boolean;
  team: Team;
  active: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  stamina: number;
  balance: number;
  down: boolean;
  stagger: number;
  charge: number;
  attack: number;
  heavy: boolean;
  struck: boolean;
  hand: number;
  cooldown: number;
  dodge: number;
  dodgeCooldown: number;
  wasDodge: boolean;
  lastHit: number;
  guarding: boolean;
  input: Input;
  seen: number;
  punches: number;
  tags: number;
  botHold: number;
  assistCharge: number;
  tagRequested: boolean;
  wasTag: boolean;
  tagTransition: number;
  tagFromX: number;
  tagFromZ: number;
  botReturning: boolean;
  combo: number;
  comboTime: number;
  whiffed: boolean;
  guardAge: number;
  parryCooldown: number;
  counter: number;
  counterPunch: boolean;
};
export type TeamState = {
  score: number;
  tagProgress: number;
  tagCooldown: number;
  towelCooldown: number;
  ropeCooldown: number;
};
export type EventKind =
  | 'punch'
  | 'hit'
  | 'block'
  | 'parry'
  | 'counter'
  | 'guard-break'
  | 'miss'
  | 'rope'
  | 'down'
  | 'tag'
  | 'towel'
  | 'launch'
  | 'bell';
export type BoxingEvent = {
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
  phase: 'lobby' | 'countdown' | 'playing' | 'stoppage' | 'ended';
  time: number;
  phaseTime: number;
  overtime: boolean;
  winner: Team | 'draw' | null;
  players: Boxer[];
  teams: Record<Team, TeamState>;
  events: BoxingEvent[];
  nextEvent: number;
  tick: number;
  remainder: number;
  partyRoundStarted?: boolean;
};
export type Snapshot = {
  code: string;
  host: string;
  selfId: string;
  version: number;
  world: World;
};
export const STEP = 1 / 60;
export const RING = { x: 5.5, z: 4.1, radius: 0.38 };
export const CORNERS = { red: { x: -4.5, z: 3.1 }, blue: { x: 4.5, z: -3.1 } };
export const otherTeam = (team: Team): Team =>
  team === 'red' ? 'blue' : 'red';
export function cleanInput(raw: Record<string, unknown>): Input {
  let x = typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : 0;
  let z = typeof raw.z === 'number' && Number.isFinite(raw.z) ? raw.z : 0;
  const length = Math.max(1, Math.hypot(x, z));
  x /= length;
  z /= length;
  return {
    x,
    z,
    punch: raw.punch === true,
    guard: raw.guard === true,
    dodge: raw.dodge === true,
    tag: raw.tag === true,
    assist: raw.assist === true,
    cancel: raw.cancel === true,
  };
}
