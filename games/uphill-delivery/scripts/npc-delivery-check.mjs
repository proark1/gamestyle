import {
  advanceDelivery,
  deliveryAction,
  deliveryPlayer,
  freshDelivery,
} from '../simulation.ts';
import { deliveryPhysics } from '../physics.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const sourceHash = createHash('sha256');
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
  sourceHash.update(readFileSync(new URL(`../${source}.ts`, import.meta.url)));
const revision = sourceHash.digest('hex');
const resume = process.argv.find((a) => a.startsWith('--resume='))?.slice(9);
const world = resume
  ? JSON.parse(readFileSync(resume, 'utf8'))
  : freshDelivery(100000);
if (!resume) {
  world.players = [deliveryPlayer('human', 'Human', 0, world.clock)];
  deliveryAction(world, 'human', { type: 'fill-npcs' }, 'human');
  deliveryAction(world, 'human', { type: 'start' }, 'human');
}
// Small initial placement differences exercise recovery without moving any body
// after the simulation starts or altering the route, hazards, or finish check.
const variant = Number(
  process.argv.find((a) => a.startsWith('--variant='))?.split('=')[1] ?? 0,
);
if (variant && !resume) {
  const offset = Math.sin(variant * 2.3) * 0.12;
  world.sofa.x += offset;
  world.sofa.z -= offset;
  world.sofa.quaternion.y = Math.sin(offset / 2);
  world.sofa.quaternion.w = Math.cos(offset / 2);
  for (const p of world.players) {
    p.x += Math.cos(variant + p.color) * 0.12;
    p.z += Math.sin(variant + p.color) * 0.12;
  }
}
if (process.argv.includes('--no-goats'))
  for (const goat of deliveryPhysics(world).goats) goat.collisionFilterMask = 0;
const seconds = Number(process.argv[2] ?? 180);
const interval = Number(
  process.argv.find((a) => a.startsWith('--interval='))?.split('=')[1] ?? 30,
);
const started = performance.now();
for (let i = 0; i < seconds * 60 && world.phase === 'playing'; i++) {
  world.players[0].seen = world.clock;
  advanceDelivery(world, world.clock + 1000 / 60);
  if (i % Math.round(interval * 60) === 0)
    console.log(
      JSON.stringify({
        t: Math.round(i / 60),
        sofa: [world.sofa.x, world.sofa.y, world.sofa.z].map(
          (n) => +n.toFixed(2),
        ),
        stage: world.npcTeam?.stage,
        gate: world.gate,
        ...(process.argv.includes('--detail')
          ? { team: world.npcTeam, yaw: world.carryYaw, sofa: world.sofa }
          : {}),
        players: world.players.map((p) => ({
          name: p.name,
          pos: [p.x, p.y, p.z].map((n) => +n.toFixed(2)),
          grip: p.grip,
          task: p.task,
          ...(process.argv.includes('--detail')
            ? {
                input: p.input,
                support: p.support,
                brain: world.npcBrains?.[p.id],
              }
            : {}),
        })),
      }),
    );
}
const result = {
  revision,
  goatsEnabled: !process.argv.includes('--no-goats'),
  limitSeconds: seconds,
  phase: world.phase,
  resumed: !!resume,
  variant,
  bestHeight: world.bestHeight,
  stage: world.npcTeam?.stage,
  sofa: { x: world.sofa.x, y: world.sofa.y, z: world.sofa.z },
  needsHelp: !!world.npcTeam?.needsHelp,
  players: world.players.map((p) => ({
    name: p.name,
    x: p.x,
    y: p.y,
    z: p.z,
    grip: p.grip,
    task: p.task,
  })),
  seconds: (world.clock - world.started) / 1000,
  workMs: performance.now() - started,
  events: world.events,
};
console.log(JSON.stringify(result));
const report = process.argv.find((a) => a.startsWith('--report='))?.slice(9);
if (report) writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
if (world.phase !== 'delivered') process.exitCode = 1;
if (process.argv.includes('--save'))
  writeFileSync(
    join(tmpdir(), `uphill-npc-debug-v${variant}.json`),
    JSON.stringify(world),
  );
