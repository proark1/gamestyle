import assert from 'node:assert/strict';

export async function castleScenario({
  connections,
  sessions,
  latest,
  inputs,
  until,
}) {
  const world = () => latest.get(sessions[1].id).world;
  assert.equal(world().players.filter((p) => !p.bot).length, 4);
  assert.equal(world().players.filter((p) => p.team === 'red').length, 2);
  const guest = sessions[1].id,
    before = world().players.find((p) => p.id === guest).x;
  inputs[1] = { x: 1, z: 0 };
  await until(
    () =>
      sessions.every(
        (s) =>
          latest.get(s.id).world.players.find((p) => p.id === guest).x >
          before + 0.3,
      ),
    'Castle guest movement reaches all four clients',
  );
  inputs[1] = { x: 0, z: 0 };
  await connections[1].action({ type: 'air', preset: 'walls' });
  await until(
    () =>
      sessions.every((s) => latest.get(s.id).world.air.blue.preset === 'walls'),
    'Castle team air allocation reaches every peer',
  );
  await until(() => world().phase === 'playing', 'Castle rally starts');
  await connections[1].action({ type: 'jump' });
  await until(
    () =>
      sessions.every(
        (s) =>
          latest.get(s.id).world.players.find((p) => p.id === guest).jumps > 0,
      ),
    'Castle jump action reaches every peer',
  );
  console.log(
    'bouncy-castle-royale: balanced 2v2 teams, guest movement, shared air allocation and jumping passed over real WebRTC.',
  );
}
