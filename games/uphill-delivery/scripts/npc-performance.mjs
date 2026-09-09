import { cpus, platform, arch } from 'node:os';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  deliveryAction,
  deliveryPlayer,
  freshDelivery,
} from '../simulation.ts';
import { tickDeliveryNpcs } from '../npcs.ts';
import { deliveryPhysics, STEP } from '../physics.ts';
import { humanPilot } from './npc-human-pilot.mjs';

const hash = createHash('sha256');
for (const source of [
  'npcs',
  'npc-carry',
  'npc-path',
  'npc-types',
  'navigation',
  'physics',
  'simulation',
  'level',
  'types',
])
  hash.update(readFileSync(new URL(`../${source}.ts`, import.meta.url)));
const revision = hash.digest('hex');

const w = freshDelivery(100000);
w.players = [deliveryPlayer('human', 'Human', 0, w.clock)];
deliveryAction(w, 'human', { type: 'fill-npcs' }, 'human');
deliveryAction(w, 'human', { type: 'start' }, 'human');
const physics = deliveryPhysics(w),
  samples = [];
const pilot = process.argv.includes('--mixed') ? humanPilot() : null;
let humanCarryFrames = 0;
for (let i = 0; i < 60 * 120; i++) {
  w.clock += STEP * 1000;
  w.players[0].seen = w.clock;
  if (pilot) pilot(w, (id, action) => deliveryAction(w, id, action, 'human'));
  if (w.players[0].grip !== null) humanCarryFrames++;
  const start = performance.now();
  tickDeliveryNpcs(w, (id, action) => deliveryAction(w, id, action, 'human'));
  const elapsed = performance.now() - start;
  if (!w.npcTeam?.needsHelp) samples.push(elapsed);
  physics.step();
}
samples.sort((a, b) => a - b);
const p95 = samples[Math.floor(samples.length * 0.95)];
console.log(
  JSON.stringify(
    {
      revision,
      scenario: pilot
        ? 'scripted human and three NPCs'
        : 'idle human and three NPCs',
      humanCarryFrames,
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      node: process.version,
      activeFrames: samples.length,
      p50Ms: samples[Math.floor(samples.length * 0.5)],
      p95Ms: p95,
      maxMs: samples.at(-1),
      targetP95Ms: 2,
    },
    null,
    2,
  ),
);
if (p95 >= 2) process.exitCode = 1;
