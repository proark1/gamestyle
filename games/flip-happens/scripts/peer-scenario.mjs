import assert from 'node:assert/strict';
export async function flipScenario({
  connections,
  sessions,
  latest,
  inputs,
  until,
}) {
  const world = () => latest.get(sessions[1].id).world;
  const guest = sessions[1].id;
  const player = () => world().players.find((p) => p.id === guest);
  assert.equal(world().players.filter((p) => !p.bot).length, 4);
  const before = player().aimX;
  inputs[1] = { x: -1, z: 0 };
  await until(
    () =>
      sessions.every(
        (s) =>
          latest.get(s.id).world.players.find((p) => p.id === guest).aimX <
          before - 0.3,
      ),
    'Guest aim reaches every peer',
  );
  inputs[1] = { x: 0, z: 0, aimX: 0, aimZ: 0 };
  await connections[1].action({ type: 'select', object: 5 });
  await until(
    () =>
      sessions.every(
        (s) =>
          latest.get(s.id).world.players.find((p) => p.id === guest)
            .selected === 5,
      ),
    'Washer selection reaches every peer',
  );
  await connections[1].action({ type: 'charge' });
  await until(
    () =>
      player().chargingAt !== null &&
      world().clock - player().chargingAt >= 1080,
    'Host measures washer charge',
  );
  await connections[1].action({ type: 'throw' });
  await until(
    () =>
      sessions.every(
        (s) =>
          latest.get(s.id).world.players.find((p) => p.id === guest).lands ===
          1,
      ),
    'Washer lands upright on all peers',
  );
  assert.equal(player().pending, 80);
  await connections[1].action({ type: 'bank' });
  await until(
    () =>
      sessions.every(
        (s) =>
          latest.get(s.id).world.players.find((p) => p.id === guest).score ===
          80,
      ),
    'Banked points agree on all peers',
  );
  console.log(
    'flip-happens: four humans, shared aiming, object selection, host-timed washer flip, upright landing and secured score passed over real WebRTC.',
  );
}
