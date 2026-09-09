// Diagnostic input driver, not a recorded human playtest. The pilot controls
// human seats only; actual NPC seats are controlled by the live simulation.
import {
  freshDelivery,
  deliveryPlayer,
  deliveryAction,
  advanceDelivery,
} from '../simulation.ts';
import { humanPilot } from './npc-human-pilot.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const humans = Number(process.argv[2] ?? 1);
const bots = Number(process.argv[3] ?? 1);
const variant = Number(process.argv[4] ?? 0);
const seconds = Number(process.argv[5] ?? 600);
if (
  !Number.isInteger(humans) ||
  !Number.isInteger(bots) ||
  humans < 1 ||
  bots < 0 ||
  humans + bots > 4 ||
  !Number.isInteger(variant) ||
  variant < 0 ||
  variant > 4 ||
  !Number.isFinite(seconds) ||
  seconds <= 0
)
  throw new Error('Invalid crew');
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
const driverRevision = createHash('sha256')
  .update(readFileSync(new URL('./npc-human-pilot.mjs', import.meta.url)))
  .update(readFileSync(new URL('./npc-mixed-check.mjs', import.meta.url)))
  .digest('hex');
const inputs = createHash('sha256');
const w = freshDelivery(100000);
w.players = Array.from({ length: humans }, (_, i) =>
  deliveryPlayer(`human-${i}`, `Pilot ${i}`, i, w.clock),
);
for (let slot = humans; slot < humans + bots; slot++)
  deliveryAction(w, 'human-0', { type: 'add-npc', slot }, 'human-0');
deliveryAction(w, 'human-0', { type: 'start' }, 'human-0');
w.started -= variant * 1500;
const pilot = humanPilot();
const counts = {
  stops: 0,
  frames: 0,
  actions: 0,
  carrying: 0,
  stoppedCarrying: 0,
  ignoredStop: 0,
};
for (let frame = 0; frame < seconds * 60 && w.phase === 'playing'; frame++) {
  const stopping =
    variant > 0 &&
    frame >= (20 + variant * 7) * 60 &&
    frame < (23 + variant * 7) * 60;
  pilot(
    w,
    (id, action) => {
      deliveryAction(w, id, action, 'human-0');
      inputs.update(JSON.stringify({ id, action, frame }));
      counts.actions++;
    },
    stopping,
  );
  inputs.update(
    JSON.stringify(w.players.filter((p) => !p.bot).map((p) => p.input)),
  );
  const together = w.players.some((p) => !p.bot && p.grip !== null);
  advanceDelivery(w, w.clock + 1000 / 60);
  if (together) counts.carrying++;
  if (together && stopping) {
    counts.stoppedCarrying++;
    if (
      w.players.some(
        (p) =>
          p.bot && p.grip !== null && Math.hypot(p.input.x, p.input.z) > 0.01,
      )
    )
      counts.ignoredStop++;
  }
  if (stopping) counts.stops++;
  counts.frames++;
  if (frame % 7200 === 0)
    console.log(
      JSON.stringify({
        t: frame / 60,
        stage: w.npcTeam?.stage,
        sofa: [w.sofa.x, w.sofa.y, w.sofa.z],
      }),
    );
}
const result = {
  revision,
  driverRevision,
  inputHash: inputs.digest('hex'),
  goatsEnabled: true,
  depotStart: true,
  limitSeconds: seconds,
  driver: 'scripted planner controls; not a human playtest',
  humans,
  bots,
  variant,
  phase: w.phase,
  seconds: counts.frames / 60,
  stops: counts.stops,
  carryingSeconds: counts.carrying / 60,
  stoppedCarryingSeconds: counts.stoppedCarrying / 60,
  ignoredStopFrames: counts.ignoredStop,
  actions: counts.actions,
  stage: w.npcTeam?.stage,
  sofa: w.sofa,
  players: w.players.map((p) => ({
    name: p.name,
    x: p.x,
    y: p.y,
    z: p.z,
    grip: p.grip,
    task: p.task,
  })),
};
console.log(JSON.stringify(result));
if (w.phase !== 'delivered') process.exitCode = 1;
const save = process.argv.find((a) => a.startsWith('--save='))?.slice(7);
if (save) writeFileSync(save, JSON.stringify(w));
const report = process.argv.find((a) => a.startsWith('--report='))?.slice(9);
if (report) writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
