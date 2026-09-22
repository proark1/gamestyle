import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceSampleStampedeTick,
  freshSampleStampedeWorld,
  newStampedePlayer,
  sampleStampedeAction,
  sampleStampedeSnapshot,
} from './simulation';
import {
  idleInput,
  type PlayerRole,
  type SampleStampedeAction,
  type SampleStampedeSnapshot,
  type SampleStampedeWorld,
  type TeamId,
} from './types';

const adapter: GameAdapter<SampleStampedeWorld, SampleStampedeSnapshot> = {
  game: 'sample-stampede',
  autonomous: (p) => !!p.bot,
  actions: ['input', 'ready', 'reset', 'switch_role', 'switch_team'],
  create: (now) => {
    const w = freshSampleStampedeWorld(now);
    // Add default bots to fill the carts for exciting 2v2 action
    w.players.push(
      newStampedePlayer(
        'bot-red-driver',
        'Cart Crusher Carl',
        1,
        'red',
        'cart-red',
        'driver',
        true,
      ),
    );
    w.players.push(
      newStampedePlayer(
        'bot-red-grabber',
        'Taquito Tina',
        2,
        'red',
        'cart-red',
        'grabber',
        true,
      ),
    );
    w.players.push(
      newStampedePlayer(
        'bot-blue-driver',
        'Bulk Barry',
        3,
        'blue',
        'cart-blue',
        'driver',
        true,
      ),
    );
    w.players.push(
      newStampedePlayer(
        'bot-blue-grabber',
        'Coupon Connie',
        4,
        'blue',
        'cart-blue',
        'grabber',
        true,
      ),
    );
    return w;
  },
  add: (w, m) => {
    // Balance teams (red or blue)
    const redHumans = w.players.filter(
      (p) => !p.bot && p.team === 'red',
    ).length;
    const blueHumans = w.players.filter(
      (p) => !p.bot && p.team === 'blue',
    ).length;
    const team: TeamId = redHumans <= blueHumans ? 'red' : 'blue';
    const cartId = team === 'red' ? 'cart-red' : 'cart-blue';

    // Prefer driver if no human driver on team yet, else grabber
    const hasDriver = w.players.some(
      (p) => !p.bot && p.team === team && p.role === 'driver',
    );
    const role: PlayerRole = hasDriver ? 'grabber' : 'driver';

    // Replace a bot occupying this slot
    const botIdx = w.players.findIndex(
      (p) => p.bot && p.team === team && p.role === role,
    );
    if (botIdx >= 0) {
      w.players.splice(botIdx, 1);
    }

    w.players.push(
      newStampedePlayer(m.id, m.name, m.color, team, cartId, role, false),
    );
  },
  remove: (w, id) => {
    const player = w.players.find((p) => p.id === id);
    if (player) {
      player.id = `bot-${id}`;
      player.name = player.role === 'driver' ? 'Cart Bot' : 'Grabber Bot';
      player.bot = true;
      player.input = idleInput();
    }
  },
  input: (w, id, raw) => {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;

    player.input = {
      x: Number(raw.x ?? raw.steer) || 0,
      z: Number(raw.z ?? raw.throttle) || 0,
      steer: Number(raw.steer ?? raw.x) || 0,
      throttle: Number(raw.throttle ?? raw.z) || 0,
      drift: raw.drift === true,
      grabberAction: raw.grabberAction === true,
      grabberAngle: Number(raw.grabberAngle) || 0,
    };
    player.seen = w.clock;
  },
  idle: (p) => {
    p.input = idleInput();
  },
  advance: advanceSampleStampedeTick,
  act: (w, id, a, host) => {
    sampleStampedeAction(w, id, a as SampleStampedeAction, host === id);
  },
  snapshot: (w, code, host, id, version) =>
    sampleStampedeSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
