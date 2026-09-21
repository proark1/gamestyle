import assert from 'node:assert/strict';
import { HARBOR, componentHome } from '../campaign.ts';

/** Four real peer clients exercise campaign cargo and prepare a rebuild handover. */
export async function campaignScenario({
  connections,
  sessions,
  latest,
  inputs,
  until,
}) {
  const world = () => latest.get(sessions[1].id).world;
  const all = (predicate) =>
    sessions.every((s) => predicate(latest.get(s.id).world));
  const stop = () => {
    for (let i = 0; i < 4; i++)
      inputs[i] = { x: 0, z: 0, reel: false, work: false, brace: true };
  };
  const sail = async (destination) => {
    await connections[0].action({ type: 'sail', destination });
    await until(
      () =>
        all(
          (w) =>
            Math.hypot(
              w.boat.x - HARBOR[destination].x,
              w.boat.z - HARBOR[destination].z,
            ) < 1,
        ),
      `campaign course ${destination}`,
      22000,
    );
  };
  const catchOne = async () => {
    const before = world().mission.caught;
    let lastCast = 0,
      pending = false;
    await until(
      () => {
        const w = world(),
          p = w.players.find((p) => p.id === sessions[0].id);
        if (all((w) => w.mission.caught > before)) return true;
        const fish = w.fish.find((f) => f.id === p.line?.target);
        inputs[0] = {
          x: 0,
          z: 0,
          brace: true,
          reel: !!p.line && !fish?.surge && p.line.tension < 0.85,
        };
        if (
          !pending &&
          Date.now() - lastCast > 800 &&
          (!p.line ||
            p.line.kind === 'player' ||
            p.line.tangled ||
            (p.line.kind === 'waiting' && w.clock - p.line.castAt > 2500))
        ) {
          pending = true;
          lastCast = Date.now();
          void (async () => {
            if (p.line)
              await connections[0].action({
                type: p.line.tangled ? 'untangle' : 'cut',
              });
            else {
              const f = w.fish
                .filter(
                  (f) =>
                    !f.respawnAt &&
                    f.kind === 'perch' &&
                    Math.hypot(f.x - w.boat.x, f.z - w.boat.z) > 6,
                )
                .sort(
                  (a, b) =>
                    Math.hypot(a.x - w.boat.x, a.z - w.boat.z) -
                    Math.hypot(b.x - w.boat.x, b.z - w.boat.z),
                )[0];
              if (f)
                await connections[0].action({ type: 'cast', x: f.x, z: f.z });
            }
          })()
            .catch((error) => console.log('cast retry:', error.message))
            .finally(() => {
              pending = false;
            });
        }
        return all((w) => w.mission.caught > before);
      },
      'campaign catch becomes cargo on all four clients',
      45000,
    );
    stop();
    await connections[0].action({ type: 'cut' });
  };
  stop();
  await sail('fish');
  await catchOne();
  assert.ok(
    all((w) => w.score === 0),
    'catches cannot count as deliveries',
  );
  await sail('home');
  inputs[0] = { x: 0, z: 0, work: true };
  await until(
    () => all((w) => w.mission.delivered === 1),
    'unload reaches all peers',
  );
  stop();
  await sail('fish');
  await catchOne();
  await until(
    () => all((w) => w.mission.status === 'recovering'),
    'unpatched tutorial leak sinks the boat',
    35000,
  );
  await until(
    () => all((w) => w.players.every((p) => p.support === 'dock')),
    'crew is rescued to construction slip',
    16000,
  );
  const move = async (index, target) => {
    await until(() => {
      const p = world().players.find((p) => p.id === sessions[index].id);
      const gap = Math.hypot(p.x - target.x, p.z - target.z);
      inputs[index] = {
        x: gap > 0.35 ? (target.x - p.x) / gap : 0,
        z: gap > 0.35 ? (target.z - p.z) / gap : 0,
        work: false,
      };
      return gap < 0.4;
    }, 'walk across the repair dock');
    inputs[index] = { x: 0, z: 0, work: false };
  };
  await move(1, componentHome(0));
  inputs[1] = { x: 0, z: 0, work: true };
  await until(
    () => all((w) => w.mission.components[0].carrier === sessions[1].id),
    'second client takes a plank',
  );
  await move(1, HARBOR.frame);
  inputs[1] = { x: 0, z: 0, work: true };
  await until(
    () => all((w) => w.mission.components[0].installed),
    'second client attaches first deck',
  );
  stop();
  await move(0, componentHome(1));
  inputs[0] = { x: 0, z: 0, work: true };
  await until(
    () => all((w) => w.mission.components[1].carrier === sessions[0].id),
    'host carries the next plank',
  );
  stop();
  console.log(
    'reel-problems-2: four WebRTC clients caught, delivered, sank, reached the dock, and attached a raft deck.',
  );
}
export async function campaignAfterHandover({ sessions, latest, until }) {
  await until(
    () =>
      sessions.slice(1).every((s) => {
        const m = latest.get(s.id).world.mission;
        return (
          m?.delivered === 1 &&
          m.status === 'recovering' &&
          m.components[0].installed &&
          !m.components[1].carrier
        );
      }),
    'campaign assembly, banked cargo, and disconnected material ownership survive host handover',
    16000,
  );
}
