import assert from 'node:assert/strict';

export async function slopewreckScenario({
  connections,
  sessions,
  latest,
  inputs,
  until,
}) {
  const world = () => latest.get(sessions[1].id).world;
  assert.equal(world().players.filter((p) => !p.bot).length, 4);
  const guest = sessions[1].id;
  const before = world().players.find((p) => p.id === guest).x;
  inputs[1] = { steer: 1, tuck: true };
  await until(
    () =>
      sessions.every(
        (s) =>
          latest.get(s.id).world.players.find((p) => p.id === guest).x >
          before + 0.3,
      ),
    'Slopewreck steering reaches all four riders',
  );
  inputs[1] = { steer: 0, tuck: true };
  await connections[0].action({ type: 'jump' });
  await until(
    () => !world().players.find((p) => p.id === sessions[0].id).grounded,
    'host rider jumps',
  );
  await connections[0].action({ type: 'trick_ramp' });
  await until(
    () =>
      sessions.every((s) =>
        latest
          .get(s.id)
          .world.features.some(
            (f) => f.owner === sessions[0].id && f.kind === 'ramp',
          ),
      ),
    'landed trick builds a shared ramp for all peers',
  );
}
