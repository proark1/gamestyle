import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import { reconcileDriveThruBots, stepDriveThruBot } from './bots';
import {
  advanceDriveThruWorld,
  driveThruAction,
  driveThruSnapshot,
  freshDriveThruWorld,
  newDriveThruPlayer,
} from './simulation';
import {
  idleInput,
  ROLES,
  type DriveThruAction,
  type DriveThruSnapshot,
  type DriveThruWorld,
  type RoleId,
} from './types';

const adapter: GameAdapter<DriveThruWorld, DriveThruSnapshot> = {
  game: 'drive-thru',
  autonomous: (p) => !!p.bot,
  actions: [
    'start',
    'restart',
    'switchRole',
    'honk',
    'flipPatty',
    'stackIngredient',
    'ventMilkshake',
    'liftFryer',
    'pushTray',
    'reachTray',
    'toggleWipers',
    'swatDistraction',
    'pourDrink',
    'stackNext',
    'selectPatty',
    'undoLayer',
  ],
  create: (now) => {
    const w = freshDriveThruWorld(now);
    reconcileDriveThruBots(w);
    return w;
  },
  add: (w, m) => {
    // Pick first unfilled role or replace bot
    const humanRoles = new Set(
      w.players.filter((p) => !p.bot).map((p) => p.role),
    );
    const availableRole: RoleId =
      ROLES.find((r) => !humanRoles.has(r)) ?? 'driver';

    // Remove existing bot in that role
    w.players = w.players.filter((p) => !(p.bot && p.role === availableRole));

    w.players.push(
      newDriveThruPlayer(m.id, m.name, m.color, availableRole, false),
    );
    reconcileDriveThruBots(w);
  },
  remove: (w, id) => {
    w.players = w.players.filter((p) => p.id !== id);
    reconcileDriveThruBots(w);
  },
  input: (w, id, raw) => {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number(raw.x) || 0,
      z: Number(raw.z) || 0,
      action1: raw.action1 === true,
      action2: raw.action2 === true,
      action3: raw.action3 === true,
      jump: raw.jump === true,
      seq: Number(raw.seq) || 0,
    };
    player.seen = w.clock;
  },
  idle: (p) => {
    p.input = idleInput();
  },
  advance: (w: DriveThruWorld, now: number) => {
    const dt = Math.min(0.1, Math.max(0.001, (now - (w.clock || now)) / 1000));
    // Step bots first
    for (const p of w.players) {
      if (p.bot) {
        stepDriveThruBot(p, w, dt);
      }
    }
    advanceDriveThruWorld(w, now);
  },
  act: (w, id, a, _host) => {
    driveThruAction(w, id, a as DriveThruAction);
  },
  snapshot: (w, code, host, id, version) =>
    driveThruSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
