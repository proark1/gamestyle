import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceReel,
  freshReel,
  newAngler,
  reelAction,
  hookedAnglers,
} from './simulation';
import { createEngine } from './peer';
import {
  BUCKET,
  type ReelWorld,
} from './types';
import { handlePeerRoom } from '../../shared/peer/coordinator';
import type { RoomStore, Row } from '../../shared/rooms/types';

const NOW = 100_000;

function tick(w: ReelWorld, ms = 50) {
  for (let left = ms; left > 0; left -= 50)
    advanceReel(w, w.clock + Math.min(50, left));
}

function memoryStore(): RoomStore {
  const rows = new Map<string, Row>();
  return {
    async get(code: string) {
      return rows.get(code) ?? null;
    },
    async insert(row: Row) {
      if (rows.has(row.code)) return false;
      rows.set(row.code, row);
      return true;
    },
    async compareAndSwap(row: Row, version: number) {
      if (rows.get(row.code)?.version !== version) return false;
      rows.set(row.code, row);
      return true;
    },
  };
}

void test('local slot management: add NPC, fill slots, remove NPC, enforce captain rights and keep bots across restart', () => {
  const w = freshReel(NOW);
  w.players.push(newAngler('human', 'Captain', 0, NOW));

  // Add one NPC to slot 2
  reelAction(w, 'human', { type: 'add-npc', slot: 2 }, 'human');
  assert.equal(w.players.length, 2);
  const bot1 = w.players.find((p) => p.bot);
  assert.ok(bot1);
  assert.equal(bot1.color, 2);

  // Cannot add to an occupied slot
  assert.throws(
    () => reelAction(w, 'human', { type: 'add-npc', slot: 2 }, 'human'),
    /empty/,
  );

  // Fill remaining slots
  reelAction(w, 'human', { type: 'fill-npcs' }, 'human');
  assert.equal(w.players.length, 4);
  assert.equal(new Set(w.players.map((p) => p.color)).size, 4);

  // Non-captain or bot cannot manage NPCs
  assert.throws(
    () => reelAction(w, bot1.id, { type: 'fill-npcs' }, 'human'),
    /captain/,
  );
  assert.throws(
    () => reelAction(w, 'human', { type: 'fill-npcs' }, 'other-host'),
    /captain/,
  );

  // Remove NPC
  reelAction(w, 'human', { type: 'remove-npc', target: bot1.id }, 'human');
  assert.equal(w.players.length, 3);
  assert.equal(w.players.some((p) => p.id === bot1.id), false);

  // Start tournament: cannot change slots during playing phase
  reelAction(w, 'human', { type: 'start' }, 'human');
  assert.equal(w.phase, 'playing');
  assert.equal(w.players.filter((p) => p.bot).length, 2);
  assert.throws(
    () => reelAction(w, 'human', { type: 'fill-npcs' }, 'human'),
    /Finish this tournament/,
  );

  // Conclude and restart: bots are preserved
  w.phase = 'won';
  reelAction(w, 'human', { type: 'fill-npcs' }, 'human');
  assert.equal(w.players.length, 4);
  reelAction(w, 'human', { type: 'restart' }, 'human');
  assert.equal(w.phase, 'playing');
  assert.equal(w.players.filter((p) => p.bot).length, 3);
  assert.equal(w.players[0].name, 'Captain');
});

void test('peer coordinator and engine integration: supportsNpcRoster, manageNpcs RPC and autonomous rejection', async () => {
  const store = memoryStore();
  const createRes = await handlePeerRoom(
    store,
    { game: 'reel-problems', op: 'create', name: 'Captain' },
    NOW,
  );
  assert.ok(createRes.session);
  const session = createRes.session;
  const instance = 'tab-1';

  // Join the hello phase so instance is registered
  const helloRes = await handlePeerRoom(
    store,
    {
      ...session,
      op: 'hello',
      instance,
    },
    NOW + 5,
  );
  const epoch = helloRes.view.epoch;

  const call = (op: string, extra: Record<string, unknown> = {}) =>
    handlePeerRoom(
      store,
      {
        ...session,
        instance,
        epoch,
        op,
        ...extra,
      },
      NOW + 10,
    );

  // Add NPC via RPC
  const added = await call('npc', {
    action: { type: 'add-npc', slot: 1 },
    requestId: 'req-1',
  });
  assert.equal(added.view.npcs?.slots.length, 1);
  assert.equal(added.view.npcs?.slots[0].color, 1);

  // Fill NPCs via RPC
  const filled = await call('npc', {
    action: { type: 'fill-npcs' },
    requestId: 'req-2',
  });
  assert.equal(filled.view.npcs?.slots.length, 3);

  // Engine reconciliation
  const engine = createEngine(NOW);
  engine.reconcile(filled.view.members, filled.view.npcs);
  assert.equal(engine.world.players.length, 4);
  assert.equal(engine.world.players.filter((p) => p.bot).length, 3);

  // Verify adapter rejects remote inputs for autonomous bots
  const botPlayer = engine.world.players.find((p) => p.bot)!;
  engine.input(botPlayer.id, { x: 1, z: 1, seq: 1 }, 1);
  // Input should remain unchanged / idle
  assert.equal(botPlayer.input.x, 0);
  assert.equal(botPlayer.input.z, 0);
});

void test('NPC casts a line when rod is empty and joins team-pull on big catches', () => {
  const w = freshReel(NOW);
  w.players.push(newAngler('human', 'Captain', 0, NOW));
  reelAction(w, 'human', { type: 'fill-npcs' }, 'human');
  reelAction(w, 'human', { type: 'start' }, 'human');

  const bots = w.players.filter((p) => p.bot);
  assert.equal(bots.length, 3);

  // Position fish within reach
  for (let i = 0; i < w.fish.length; i++) {
    w.fish[i].respawnAt = 0;
    w.fish[i].x = w.boat.x + 8 + i * 2;
    w.fish[i].z = w.boat.z;
  }

  // Tick the simulation: bots should cast
  tick(w, 300);
  const castingBots = bots.filter((p) => p.line !== null);
  assert.ok(castingBots.length > 0, 'At least one bot should cast');

  // If human hooks the monster fish, bots should join in to help pull
  const monster = w.fish.find((f) => f.kind === 'monster')!;
  monster.x = w.boat.x + 9;
  monster.z = w.boat.z;
  monster.respawnAt = 0;

  // Clear bot lines
  for (const b of bots) b.line = null;
  // Human hooks monster
  w.players[0].line = {
    kind: 'fish',
    target: monster.id,
    x: monster.x,
    z: monster.z,
    length: 9,
    tension: 0.3,
    strain: 0,
    tangled: false,
    crossing: 0,
    castAt: w.clock,
    clearUntil: w.clock + 1000,
  };

  tick(w, 400);
  const helpers = hookedAnglers(w, monster.id);
  assert.ok(helpers.length >= 1);
});

void test('NPC eases off reeling during fish surge or high tension to prevent line snap', () => {
  // Use a clock where Math.sin(w.clock / 1050) is negative (no surge by default)
  const CALM_CLOCK = 101_500;
  const w = freshReel(CALM_CLOCK);
  w.players.push(newAngler('human', 'Captain', 0, CALM_CLOCK));
  reelAction(w, 'human', { type: 'add-npc', slot: 1 }, 'human');
  reelAction(w, 'human', { type: 'start' }, 'human');

  const bot = w.players.find((p) => p.bot)!;
  const perch = w.fish.find((f) => f.kind === 'perch')!;
  perch.respawnAt = 0;
  perch.surge = false;
  perch.stamina = 10;

  bot.line = {
    kind: 'fish',
    target: perch.id,
    x: perch.x,
    z: perch.z,
    length: 6,
    tension: 0.3,
    strain: 0,
    tangled: false,
    crossing: 0,
    castAt: w.clock,
    clearUntil: w.clock + 5000,
  };

  // Normal calm fish: bot should reel in
  tick(w, 50);
  assert.equal(bot.input.reel, true, 'Bot should reel when tension is low and fish is not surging');

  // Now fish surges
  perch.surge = true;
  tick(w, 50);
  assert.equal(bot.input.reel, false, 'Bot should stop reeling during surge');
  assert.equal(bot.input.brace, true, 'Bot should brace during surge');

  // Surge stops but line tension is dangerous
  perch.surge = false;
  bot.line.tension = 0.95;
  tick(w, 50);
  assert.equal(bot.input.reel, false, 'Bot should not reel when line tension is dangerous');
});

void test('NPC rushes to patch leak and bails water when flooded', () => {
  const w = freshReel(NOW);
  w.players.push(newAngler('human', 'Captain', 0, NOW));
  reelAction(w, 'human', { type: 'add-npc', slot: 1 }, 'human');
  reelAction(w, 'human', { type: 'start' }, 'human');

  const bot = w.players.find((p) => p.bot)!;

  // Boat springs a leak
  w.leak = {
    x: 0,
    z: 1.5,
    at: w.clock,
    patch: 0,
    warned: false,
  };

  // Bot should move toward leak and patch
  bot.x = 0;
  bot.z = 1.6; // right beside leak
  tick(w, 100);
  assert.equal(bot.input.reel, true, 'Bot should hold reel (patch) when standing at leak');
  assert.equal(bot.task, 'Patching leak');

  // Now leak is patched, but boat is flooded
  w.leak = null;
  w.boat.flood = 0.35;
  bot.x = BUCKET.x;
  bot.z = BUCKET.z; // beside bucket
  tick(w, 100);
  assert.equal(bot.input.reel, true, 'Bot should hold reel (bail) when at bucket in a flooded boat');
  assert.equal(bot.task, 'Bailing water');
});

void test('NPC jumps to scare seagull away when catch is in peril', () => {
  const w = freshReel(NOW);
  w.players.push(newAngler('human', 'Captain', 0, NOW));
  reelAction(w, 'human', { type: 'add-npc', slot: 1 }, 'human');
  reelAction(w, 'human', { type: 'start' }, 'human');

  const bot = w.players.find((p) => p.bot)!;
  bot.y = 0;
  bot.vy = 0;

  // A seagull dives for a catch
  w.pending = {
    kind: 'perch',
    crew: ['human'],
    until: w.clock + 1500,
    gull: 'gull-1',
  };

  tick(w, 100);
  assert.ok(bot.y > 0 || bot.vy > 0, 'Bot should jump to scare seagull');
});

void test('NPC climbs aboard when swimming and rescues drowning teammates', () => {
  const w = freshReel(NOW);
  w.players.push(newAngler('human', 'Captain', 0, NOW));
  reelAction(w, 'human', { type: 'add-npc', slot: 1 }, 'human');
  reelAction(w, 'human', { type: 'start' }, 'human');

  const bot = w.players.find((p) => p.bot)!;

  // Bot falls overboard and clings to hull
  bot.swimming = true;
  bot.overboardAt = w.clock;
  bot.clinging = true;
  bot.climb = 0.2;
  bot.x = w.boat.x + 2.75;
  bot.z = w.boat.z;

  tick(w, 50);
  assert.equal(bot.input.reel, true, 'Bot should hold climb when clinging');

  // Now bot is back aboard, and human teammate is swimming nearby
  bot.swimming = false;
  bot.clinging = false;
  bot.x = 0;
  bot.z = 0;

  const human = w.players.find((p) => !p.bot)!;
  human.swimming = true;
  human.overboardAt = w.clock;
  human.x = w.boat.x + 1.5;
  human.z = w.boat.z + 1.5;

  tick(w, 300);
  assert.equal(human.swimming, false, 'Bot should rescue nearby drowning human');
});
