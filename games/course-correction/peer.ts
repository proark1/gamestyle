import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceWorld,
  courseAction,
  freshWorld,
  newPlayer,
  replaceOwner,
  setInput,
  snapshot,
} from './simulation';
import { idleInput, type CourseSnapshot, type CourseWorld } from './types';

const adapter: GameAdapter<CourseWorld, CourseSnapshot> = {
  game: 'course-correction',
  snapshotDetached: true,
  canJoin: () => true,
  autonomous: (player) => player.bot,
  actions: ['start', 'ready', 'aim', 'lock', 'shoot', 'restart'],
  create: freshWorld,
  add: (world, member) => {
    const player = world.players.find((candidate) => candidate.bot);
    if (!player) throw new Error('The course is full.');
    replaceOwner(world, player.id, member.id);
    Object.assign(player, {
      id: member.id,
      name: member.name,
      color: member.color,
      bot: false,
      seen: world.clock,
      input: idleInput(),
      openingReady: false,
    });
  },
  remove: (world, id) => {
    const player = world.players.find((candidate) => candidate.id === id);
    if (!player) return;
    const bot = newPlayer(player.seat);
    replaceOwner(world, player.id, bot.id);
    Object.assign(player, bot, {
      totalStrokes: player.totalStrokes,
      holeStrokes: player.holeStrokes,
      assists: player.assists,
      finishedAt: player.finishedAt,
      botAt: world.clock + 650,
    });
  },
  input: setInput,
  idle: (player) => {
    player.input = idleInput();
  },
  advance: advanceWorld,
  act: (world, id, action, host) =>
    courseAction(world, id, action, host === id),
  snapshot,
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
