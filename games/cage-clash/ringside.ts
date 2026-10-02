import * as T from 'three';
import { ball, beam, box, taper } from '../../shared/rendering/primitives';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { TEAM } from '../../shared/rendering/palette';
import type { Look } from '../../shared/wardrobe/look';
import { label } from './signage';

type Fan = {
  root: T.Group;
  left: T.Group;
  right: T.Group;
  y: number;
  phase: number;
  eager: boolean;
};
const outfits: Look[] = [
  {},
  { hat: 'bobble-beanie' },
  { top: 'striped-tee' },
  {},
  { hat: 'skipper-cap' },
  { top: 'bow-tie' },
];

export function createRingside() {
  const root = new T.Group();
  const crowd: Fan[] = [];
  let fanIndex = 0;
  // Two compact stands with a central aisle keep both corners accessible.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const z = side * (7.1 + row * 1.15);
      const seatY = -0.18 + row * 0.43;
      for (const block of [-1, 1]) {
        const x = block * 3.9;
        box(root, [6.25, 0.16, 0.72], [x, seatY, z], '#bb9668', true);
        box(
          root,
          [6.25, 0.24, 0.12],
          [x, seatY + 0.43, z + side * 0.37],
          '#d1af7f',
          true,
        );
        for (const dx of [-2.7, 0, 2.7]) {
          beam(
            root,
            [x + dx, -0.8, z],
            [x + dx, seatY + 0.42, z + side * 0.35],
            0.09,
            '#52685d',
          );
        }
        for (let seat = 0; seat < 4; seat++) {
          if ((seat + row + (block > 0 ? 1 : 0)) % 6 === 5) continue;
          const index = fanIndex++;
          const shirt = [
            TEAM.red,
            '#dfb854',
            TEAM.blue,
            '#9d766d',
            '#668573',
            '#eee3c8',
          ][index % 6];
          const { model } = dressedGameAvatar(
            index,
            { shirt, overalls: '#52676a', boots: '#eee5ce', trousers: true },
            outfits[index % outfits.length],
          );
          const rig = model.userData as Record<string, T.Group>;
          model.scale.setScalar(0.72 + (index % 3) * 0.025);
          model.position.set(
            x + (seat - 1.5) * 1.48,
            seatY - 0.47,
            z - side * 0.06,
          );
          model.rotation.y = side > 0 ? Math.PI : 0;
          rig.legL.rotation.x = rig.legR.rotation.x = -1.28;
          rig.armL.rotation.set(-0.8, 0, -0.16);
          rig.armR.rotation.set(-0.8, 0, 0.16);
          const eager = index % 4 === 0;
          if (eager) {
            rig.armR.rotation.x = -2.35;
            // Team pennants stay attached to the waving hand.
            const hand = rig.sleeveR;
            beam(hand, [0, -0.38, 0], [0, -0.95, 0], 0.035, '#dab779');
            const flag = new T.Mesh(
              new T.BufferGeometry().setAttribute(
                'position',
                new T.Float32BufferAttribute(
                  [0, -0.95, 0, 0.36, -0.86, 0, 0, -0.65, 0],
                  3,
                ),
              ),
              new T.MeshStandardMaterial({
                color: index % 8 ? TEAM.blue : TEAM.red,
                side: T.DoubleSide,
                roughness: 0.9,
              }),
            );
            flag.geometry.computeVertexNormals();
            hand.add(flag);
          }
          // Freeze facial/leg detail into batches; only the cheering arms move.
          batchScenery(model, [rig.armL, rig.armR], true);
          batchScenery(rig.armL, [], true);
          batchScenery(rig.armR, [], true);
          root.add(model);
          // Animate a staggered subset; the rest share the stand's static batches.
          if (row < 2 && seat % 2 === 0)
            crowd.push({
              root: model,
              left: rig.armL,
              right: rig.armR,
              y: model.position.y,
              phase: index * 2.39,
              eager,
            });
        }
      }
      box(
        root,
        [1.05, 0.15 + row * 0.43, 1.05],
        [0, -0.7 + row * 0.215, z],
        '#c2b18c',
        true,
      );
      box(
        root,
        [0.9, 0.025, 0.09],
        [0, -0.61 + row * 0.43, z - side * 0.46],
        '#e9d9ad',
      );
    }
    for (const x of [-8.1, 8.1]) {
      taper(root, 0.07, 0.12, 5.3, [x, 1.85, side * 8.5], '#53685b');
      box(root, [1.15, 0.38, 0.36], [x, 4.5, side * 8.5], '#456056', true);
      for (const dx of [-0.34, 0, 0.34])
        ball(
          root,
          [0.12, 0.13, 0.12],
          [x + dx, 4.5, side * 8.5 - side * 0.2],
          '#fff1c2',
        );
    }
    // Bunting is behind the seats, never over the fighting space.
    const z = side * 10.1;
    for (let i = 0; i < 20; i++) {
      const x = -8 + i * 0.8;
      const y = 2.9 + 0.65 * (x / 8) ** 2;
      beam(
        root,
        [x, y, z],
        [x + 0.8, 2.9 + 0.65 * ((x + 0.8) / 8) ** 2, z],
        0.025,
        '#e8dab9',
      );
      const geometry = new T.BufferGeometry().setAttribute(
        'position',
        new T.Float32BufferAttribute(
          [x + 0.08, y - 0.03, z, x + 0.68, y - 0.03, z, x + 0.38, y - 0.64, z],
          3,
        ),
      );
      const flag = new T.Mesh(
        geometry,
        new T.MeshStandardMaterial({
          color: [TEAM.red, '#ead6a4', TEAM.blue][i % 3],
          side: T.DoubleSide,
          roughness: 0.9,
        }),
      );
      geometry.computeVertexNormals();
      root.add(flag);
    }
  }
  // A clear, warm ringside walkway, with painted perimeter markings.
  for (const side of [-1, 1]) {
    const x = side * 10.6;
    for (const z of [-4.8, 2.4])
      taper(root, 0.05, 0.07, 2.7, [x, 0.55, z], '#6c8067');
    for (let i = 0; i < 9; i++) {
      const z = -4.8 + i * 0.8;
      const sag = (t: number) => 1.55 + 0.35 * ((t + 1.2) / 3.6) ** 2;
      beam(root, [x, sag(z), z], [x, sag(z + 0.8), z + 0.8], 0.025, '#eadabb');
      const geometry = new T.BufferGeometry().setAttribute(
        'position',
        new T.Float32BufferAttribute(
          [
            x,
            sag(z) - 0.03,
            z + 0.08,
            x,
            sag(z) - 0.03,
            z + 0.66,
            x,
            sag(z) - 0.48,
            z + 0.37,
          ],
          3,
        ),
      );
      geometry.computeVertexNormals();
      root.add(
        new T.Mesh(
          geometry,
          new T.MeshStandardMaterial({
            color: [TEAM.red, '#e9d9b1', TEAM.blue][i % 3],
            side: T.DoubleSide,
            roughness: 0.9,
          }),
        ),
      );
    }
  }
  for (const x of [-8.35, 8.35])
    box(root, [0.055, 0.012, 11.6], [x, -0.79, 0], '#dccda9');
  for (const x of [-10.2, 10.2]) {
    box(root, [2.2, 0.65, 0.85], [x, -0.45, -6.1], '#c5ae85', true);
    for (let i = 0; i < 5; i++) {
      const stemX = x - 0.85 + i * 0.42;
      beam(
        root,
        [stemX, -0.12, -6.1],
        [stemX + 0.12, 0.55 + (i % 2) * 0.28, -6.1],
        0.035,
        '#59765a',
      );
      const leaf = ball(
        root,
        [0.19, 0.4, 0.11],
        [stemX, 0.38, -6.1],
        i % 2 ? '#769168' : '#567c65',
      );
      leaf.rotation.z = i % 2 ? -0.4 : 0.4;
    }
  }
  // Timekeeper's table and brass bell at the open side of the ring.
  const desk = new T.Group();
  desk.position.set(8.7, 0, 0.6);
  desk.rotation.y = -Math.PI / 2;
  box(desk, [2.5, 0.16, 1.1], [0, 0.12, 0], '#b38c61', true);
  for (const x of [-1, 1])
    for (const z of [-0.37, 0.37])
      beam(desk, [x, -0.78, z], [x, 0.05, z], 0.09, '#4e695f');
  taper(desk, 0.28, 0.32, 0.07, [-0.65, 0.25, 0], '#47685e', 16);
  ball(desk, [0.23, 0.16, 0.23], [-0.65, 0.34, 0], '#dbb45c');
  taper(desk, 0.035, 0.035, 0.12, [-0.65, 0.49, 0], '#816242');
  box(desk, [0.45, 0.025, 0.58], [0.4, 0.22, 0], '#f5e9ce');
  beam(desk, [0.3, 0.25, -0.15], [0.52, 0.25, 0.12], 0.025, '#405d52');
  const plate = label('RINGSIDE', '#efe3c5', '#41695c', 1.8, 0.38);
  plate.position.set(0, -0.17, 0.57);
  desk.add(plate);
  root.add(desk);
  // Equipment gives the unused aisle a purpose without filling the corners.
  for (const x of [-9, 9]) {
    box(root, [0.85, 1.15, 0.7], [x, -0.2, 4.4], '#3d5750', true);
    for (const y of [-0.35, 0.1]) {
      const cone = taper(root, 0.22, 0.22, 0.03, [x, y, 4.77], '#253e39', 16);
      cone.rotation.x = Math.PI / 2;
    }
    box(root, [0.7, 0.06, 0.42], [x, 0.42, 4.4], '#dcc89e', true);
    taper(root, 0.085, 0.1, 0.32, [x + 0.2, 0.59, 4.4], '#a7c4b5');
  }
  // Share draw calls across static furniture and decorations.
  batchScenery(
    root,
    crowd.map((fan) => fan.root),
    true,
  );
  return { root, crowd };
}

export function animateCrowd(
  crowd: Fan[],
  time: number,
  excitement: number,
  reduced: boolean,
) {
  for (const fan of crowd) {
    const wave = reduced ? 0 : Math.sin(time * 4.5 + fan.phase);
    const cheer = reduced
      ? 0
      : excitement * (0.7 + 0.3 * Math.sin(time * 7 + fan.phase));
    fan.root.position.y =
      fan.y +
      (reduced ? 0 : Math.sin(time * 1.7 + fan.phase) * 0.012 + cheer * 0.065);
    fan.left.rotation.x = -0.8 - cheer * 1.7;
    fan.right.rotation.x = fan.eager
      ? -2.35 + wave * 0.16 - cheer * 0.25
      : -0.8 - cheer * 1.8;
    fan.left.rotation.z = -0.16 - cheer * 0.25;
    fan.right.rotation.z = 0.16 + cheer * 0.25;
  }
}
