import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FLOOR, STATIONS, dimensions, type PartKind } from './model';
import { BOARD, CONES, TRUCK, type Solid } from './site-layout';
import { createDetailMaterials } from './detail-materials';
import { bakeModel, mesh, ring, rod, rounded } from './detail-geometry';
import {
  makeCementSack,
  makePallet,
  makePickup,
  makeSandCrate,
  makeWaterBarrel,
} from './detailed-props';

export const COLORS = [0xe7a12e, 0x53968a, 0xc25d48, 0x7298bd];
export function createMaterials() {
  const loader = new T.TextureLoader();
  const texture = (name: string, repeat: number) => {
    const t = loader.load(`/first-person/textures/${name}.jpg`);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    return t;
  };
  const dirt = texture('dirt', 18),
    wood = texture('wood', 1),
    brick = texture('brick', 1);
  // Only a clay face is sampled: every rendered brick is one actual building piece.
  brick.repeat.set(0.14, 0.027);
  brick.offset.set(0.217, 0.8565);
  const details = createDetailMaterials();
  return {
    ...details,
    dirt: new T.MeshStandardMaterial({
      map: dirt,
      color: 0xc1b08b,
      roughness: 1,
    }),
    wood: new T.MeshStandardMaterial({
      map: wood,
      color: 0xbb9361,
      roughness: 0.85,
    }),
    brick: new T.MeshStandardMaterial({
      map: brick,
      color: 0xc68b6d,
      roughness: 0.94,
      bumpMap: brick,
      bumpScale: 0.013,
    }),
    concrete: new T.MeshStandardMaterial({ color: 0xc3c1b4, roughness: 1 }),
    mortar: new T.MeshStandardMaterial({
      color: 0xe2dcc9,
      roughness: 0.82,
      bumpMap: details.cement.map,
      bumpScale: 0.008,
    }),
    metal: new T.MeshStandardMaterial({
      color: 0x434a48,
      roughness: 0.55,
      metalness: 0.65,
    }),
    orange: new T.MeshStandardMaterial({
      color: 0xe99331,
      roughness: 0.45,
      metalness: 0.3,
    }),
    pale: new T.MeshStandardMaterial({ color: 0xf0e4bc, roughness: 0.9 }),
    roof: new T.MeshStandardMaterial({
      color: 0x53645d,
      roughness: 0.68,
      metalness: 0.2,
    }),
    rubber: new T.MeshStandardMaterial({ color: 0x262b29, roughness: 0.9 }),
    water: new T.MeshStandardMaterial({
      color: 0x729ead,
      roughness: 0.22,
      metalness: 0.3,
    }),
  };
}
export type Materials = ReturnType<typeof createMaterials>;
export function box(
  parent: T.Object3D,
  size: number[],
  pos: number[],
  material: T.Material,
  cast = true,
) {
  const mesh = new T.Mesh(
    new T.BoxGeometry(size[0], size[1], size[2]),
    material,
  );
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(
  parent: T.Object3D,
  rt: number,
  rb: number,
  h: number,
  material: T.Material,
  pos: number[],
  segments = 16,
) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(rt, rb, h, segments),
    material,
  );
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function label(
  parent: T.Object3D,
  text: string,
  y: number,
  color = '#f3edd6',
  width = 1.7,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#243d35';
  ctx.fillRect(0, 0, 512, 112);
  ctx.strokeStyle = '#72856c';
  ctx.lineWidth = 5;
  ctx.strokeRect(9, 9, 494, 94);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText(text, 256, 57, 476);
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(
    new T.PlaneGeometry(width, (width * 112) / 512),
    new T.MeshBasicMaterial({ map: t }),
  );
  mesh.position.y = y;
  parent.add(mesh);
  mesh.userData.sign = true;
  const back = new T.Mesh(mesh.geometry, mesh.material);
  back.rotation.y = Math.PI;
  back.position.z = -0.003;
  mesh.add(back);
  return mesh;
}
export function makePart(kind: PartKind, mats: Materials, rotation = 0) {
  const d = dimensions(kind, kind === 'beam' && rotation === 2 ? 2 : 0);
  return new T.Mesh(
    kind === 'brick'
      ? new RoundedBoxGeometry(d.w - 0.006, d.h - 0.025, d.d - 0.006, 2, 0.006)
      : new RoundedBoxGeometry(d.w, d.h, d.d, 1, 0.004),
    kind === 'beam' ? mats.wood : mats[kind],
  );
}
export function createSite(scene: T.Scene, mats: Materials) {
  const targets: T.Object3D[] = [],
    solids: Solid[] = [];
  const addSolid = (s: Solid, name: string, interaction?: string) => {
    solids.push(s);
    const bottom = s.bottom ?? 0;
    const hit = box(
      scene,
      [s.w, s.h - bottom, s.d],
      [s.x, (s.h + bottom) / 2, s.z],
      new T.MeshBasicMaterial({ visible: false }),
      false,
    );
    hit.rotation.y = s.rotation ?? 0;
    hit.userData.solidLabel = name;
    hit.userData.interaction = interaction;
    targets.push(hit);
  };
  const ground = box(scene, [220, 0.3, 220], [0, -0.18, 0], mats.dirt, false);
  ground.receiveShadow = true;
  const foundation = box(
    scene,
    [8, FLOOR, 6],
    [0, FLOOR / 2, 0],
    mats.concrete,
    false,
  );
  foundation.userData.foundation = true;
  targets.push(foundation);
  const grid = new T.GridHelper(8, 32, 0xa1a292, 0xb2b2a3);
  grid.position.y = FLOOR + 0.002;
  scene.add(grid);
  // Crop the square grid into a true 25-cm grid on the rectangular foundation.
  const positions = grid.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++)
    positions.setZ(i, Math.max(-3, Math.min(3, positions.getZ(i))));
  // Chalk boundary and timber formwork make the available footprint readable in perspective.
  for (const z of [-3.1, 3.1])
    box(scene, [8.4, 0.18, 0.09], [0, 0.09, z], mats.wood);
  for (const x of [-4.1, 4.1])
    box(scene, [0.09, 0.18, 6.2], [x, 0.09, 0], mats.wood);
  const chalk = new T.MeshBasicMaterial({ color: 0xf0e4bd });
  for (const z of [-2.8, 2.8])
    box(scene, [7.6, 0.002, 0.025], [0, FLOOR + 0.004, z], chalk, false);
  for (const x of [-3.8, 3.8])
    box(scene, [0.025, 0.002, 5.6], [x, FLOOR + 0.004, 0], chalk, false);

  const stationGroups: Record<string, T.Group> = {};
  let drum!: T.Group;
  for (const s of STATIONS) {
    const g = new T.Group();
    g.position.set(s.x, 0, s.z);
    scene.add(g);
    stationGroups[s.id] = g;
    const hit = box(
      g,
      [1.7, 1.5, 1.5],
      [0, 0.75, 0],
      new T.MeshBasicMaterial({ visible: false }),
      false,
    );
    hit.userData.station = s.id;
    targets.push(hit);
    solids.push({
      x: s.x,
      z: s.z,
      w: s.id === 'beam' ? 2.5 : s.id === 'water' ? 1.03 : 1.5,
      d: 1.3,
      h: s.id === 'mixer' ? 1.8 : s.id === 'water' ? 1.07 : 0.95,
    });
    if (s.id === 'mixer') {
      for (const x of [-0.55, 0.55]) {
        const wheel = cylinder(g, 0.27, 0.27, 0.15, mats.rubber, [
          x,
          0.29,
          0.38,
        ]);
        wheel.rotation.z = Math.PI / 2;
        cylinder(
          g,
          0.115,
          0.115,
          0.16,
          mats.steel,
          [x, 0.29, 0.38],
          24,
        ).rotation.z = Math.PI / 2;
        box(g, [0.07, 1, 0.07], [x, 0.6, 0.18], mats.metal).rotation.x = -0.28;
      }
      box(g, [1.15, 0.08, 0.08], [0, 0.46, 0.38], mats.metal);
      box(g, [0.09, 0.9, 0.09], [0, 0.47, -0.65], mats.metal).rotation.x = 0.28;
      const cradle = new T.Group();
      cradle.position.set(0, 1.18, -0.02);
      cradle.rotation.x = 0.62;
      g.add(cradle);
      drum = new T.Group();
      cradle.add(drum);
      const profile = [
        [0.05, -0.355],
        [0.43, -0.355],
        [0.49, -0.25],
        [0.52, 0.18],
        [0.34, 0.48],
        [0.315, 0.485],
        [0.306, 0.46],
        [0.485, 0.16],
        [0.405, -0.3],
      ].map(([x, y]) => new T.Vector2(x, y));
      mesh(drum, new T.LatheGeometry(profile, 40), mats.orange);
      cylinder(drum, 0.408, 0.408, 0.016, mats.metal, [0, -0.3, 0], 32);
      ring(drum, 0.326, 0.016, [0, 0.477, 0], mats.steel).rotation.x =
        Math.PI / 2;
      ring(drum, 0.517, 0.012, [0, 0.17, 0], mats.steel).rotation.x =
        Math.PI / 2;
      cylinder(drum, 0.423, 0.423, 0.014, mats.mortar, [0, -0.2, 0], 32);
      for (const a of [0, Math.PI * 0.66, Math.PI * 1.33])
        rounded(
          drum,
          [0.035, 0.38, 0.1],
          [Math.sin(a) * 0.34, 0.01, Math.cos(a) * 0.34],
          mats.metal,
          0.007,
        ).rotation.y = a;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        box(
          drum,
          [0.04, 0.48, 0.04],
          [Math.sin(a) * 0.48, -0.05, Math.cos(a) * 0.48],
          mats.metal,
        );
      }
      bakeModel(drum);
      const handwheel = ring(g, 0.29, 0.025, [0.73, 1, -0.05], mats.orange);
      handwheel.rotation.y = Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        rod(
          g,
          [0.73, 1, -0.05],
          [0.73, 1 + Math.sin(a) * 0.28, -0.05 + Math.cos(a) * 0.28],
          0.012,
          mats.steel,
        );
      }
      box(g, [0.2, 0.18, 0.25], [0.62, 0.74, 0.2], mats.metal);
      box(
        g,
        [0.025, 0.075, 0.075],
        [0.73, 0.76, 0.25],
        new T.MeshStandardMaterial({
          color: 0x82b453,
          emissive: 0x305d1b,
          emissiveIntensity: 0.3,
        }),
      );
      const sign = label(g, 'MORTAR · 1 : 2 : 1', 2.05);
      sign.rotation.y = 0.2;
    } else if (s.id === 'brick') {
      const stock = makePallet(mats, 1.5);
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < 3; x++)
          for (let z = 0; z < 3; z++)
            rounded(
              stock,
              [0.44, 0.2, 0.28],
              [x * 0.46 - 0.46, 0.3 + y * 0.21, z * 0.3 - 0.3],
              mats.brick,
              0.009,
            );
      g.add(bakeModel(stock));
      label(g, 'BRICKS', 1.28, undefined, 1.3);
    } else if (s.id === 'cement') {
      const stock = makePallet(mats);
      for (let y = 0; y < 3; y++)
        for (const x of [-0.32, 0.32]) {
          const sack = makeCementSack(mats);
          sack.position.set(x, 0.31 + y * 0.232, 0);
          sack.rotation.y = y % 2 ? 0.07 : -0.04;
          stock.add(sack);
        }
      g.add(bakeModel(stock));
      label(g, 'CEMENT', 1.3, undefined, 1.4);
    } else if (s.id === 'sand') {
      g.add(makeSandCrate(mats));
      label(g, 'SAND', 1.48, undefined, 1.2);
    } else if (s.id === 'water') {
      g.add(makeWaterBarrel(mats));
      label(g, 'WATER', 1.55, undefined, 1.4);
    } else if (s.id === 'beam') {
      const stock = makePallet(mats, 2.5, 1.1);
      for (let y = 0; y < 3; y++)
        for (const z of [-0.36, 0, 0.36])
          rounded(
            stock,
            [2.5, 0.22, 0.27],
            [0, 0.31 + y * 0.23, z],
            mats.wood,
            0.007,
          );
      g.add(bakeModel(stock));
      label(g, 'BEAMS', 1.3, undefined, 1.4);
    } else {
      const stock = makePallet(mats, 1.5, 1.2);
      for (let y = 0; y < 5; y++)
        rounded(
          stock,
          [1.5, 0.025, 1.1],
          [0, 0.225 + y * 0.043, 0],
          mats.roof,
          0.004,
        );
      for (let i = 0; i < 8; i++)
        rounded(
          stock,
          [0.025, 0.02, 1.09],
          [-0.68 + i * 0.194, 0.422, 0],
          mats.roof,
          0.006,
        );
      g.add(bakeModel(stock));
      label(g, 'ROOF PANELS', 1.15, undefined, 1.9);
    }
    for (const object of g.children)
      if (object.userData.sign) object.rotation.y = Math.atan2(-s.x, -s.z);
  }
  // Open timber scaffold: a short flight of real, walkable steps beside the plot.
  for (let i = 0; i < 8; i++) {
    const z = 1.15 - i * 0.5,
      h = (i + 1) * 0.25;
    box(scene, [1.4, 0.08, 0.5], [4.95, h - 0.04, z], mats.wood);
    solids.push({ x: 4.95, z, w: 1.4, d: 0.5, h });
    for (const x of [4.35, 5.55])
      box(scene, [0.08, h, 0.08], [x, h / 2, z], mats.metal);
  }
  box(scene, [1.4, 0.1, 1.5], [4.95, 1.95, -3], mats.wood);
  solids.push({ x: 4.95, z: -3, w: 1.4, d: 1.5, h: 2 });

  // Site fence and background are visual boundaries; no invisible building controls.
  for (let i = -10; i <= 10; i += 2) {
    for (const z of [-9.8, 10.5])
      box(scene, [0.13, 1.35, 0.13], [i, 0.675, z], mats.wood);
    for (const x of [-10.8, 10.8])
      box(scene, [0.13, 1.35, 0.13], [x, 0.675, i], mats.wood);
  }
  for (const y of [0.45, 1]) {
    for (const z of [-9.8, 10.5])
      box(scene, [21, 0.13, 0.06], [0, y, z], mats.wood);
    for (const x of [-10.8, 10.8])
      box(scene, [0.06, 0.13, 20], [x, y, 0], mats.wood);
  }
  const board = new T.Group();
  board.position.set(BOARD.x, 0, BOARD.z);
  scene.add(board);
  for (const x of [-0.95, 0.95])
    box(board, [0.1, 2.7, 0.1], [x, 1.35, 0], mats.wood);
  box(board, [2.5, 1.5, 0.12], [0, 2.1, 0], mats.pale);
  label(board, 'CAUTION · BUILDING SITE', 2.52, '#eeb751', 2.2).position.z =
    0.07;
  label(board, 'ROOF-RAISING RACE · 5 MIN', 2.05, undefined, 2.2).position.z =
    0.07;
  label(
    board,
    'PRESS E TO START · 1–4 PLAYERS',
    1.62,
    undefined,
    2.2,
  ).position.z = 0.07;
  addSolid(BOARD, 'Site sign', 'race');
  for (const x of [-0.95, 0.95])
    addSolid(
      { x: BOARD.x + x, z: BOARD.z, w: 0.1, d: 0.1, h: 2.7 },
      'Signpost',
    );
  // A parked builder's pickup gives the empty plot a familiar human scale.
  const truck = makePickup(mats);
  truck.position.set(TRUCK.x, 0, TRUCK.z);
  truck.rotation.y = TRUCK.rotation;
  scene.add(truck);
  addSolid(TRUCK, 'Clocking-off express', 'horn');
  const coneMat = new T.MeshStandardMaterial({
    color: 0xe77b38,
    roughness: 0.7,
  });
  for (const [x, z] of CONES) {
    box(scene, [0.45, 0.04, 0.45], [x, 0.02, z], mats.rubber);
    cylinder(scene, 0.035, 0.18, 0.55, coneMat, [x, 0.315, z]);
    cylinder(scene, 0.085, 0.11, 0.12, mats.pale, [x, 0.4, z]);
    addSolid({ x, z, w: 0.36, d: 0.36, h: 0.59 }, 'Traffic cone');
  }

  // Deterministic instancing keeps a dense wooded landscape inexpensive in the browser.
  let seed = 17;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const foliageMat = new T.MeshStandardMaterial({
    color: 0x6b8652,
    roughness: 1,
  });
  const leafGeometry = new T.IcosahedronGeometry(1, 1);
  const vertices = leafGeometry.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i),
      y = vertices.getY(i),
      z = vertices.getZ(i),
      r = 1 + 0.13 * Math.sin(x * 31 + y * 17 + z * 23);
    vertices.setXYZ(i, x * r, y * r, z * r);
  }
  leafGeometry.computeVertexNormals();
  const leaves = new T.InstancedMesh(leafGeometry, foliageMat, 40 * 26);
  const bark = new T.MeshStandardMaterial({
    map: mats.wood.map,
    color: 0x635340,
    roughness: 1,
  });
  const trunks = new T.InstancedMesh(
    new T.CylinderGeometry(0.1, 0.24, 3.6, 9),
    bark,
    40,
  );
  const branches = new T.InstancedMesh(
    new T.CylinderGeometry(0.025, 0.1, 1, 7),
    bark,
    40 * 6,
  );
  const dummy = new T.Object3D(),
    color = new T.Color();
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2,
      radius = 16 + random() * 23,
      x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius,
      scale = 0.8 + random() * 1.2;
    dummy.position.set(x, 1.8 * scale, z);
    dummy.rotation.set(0, random() * Math.PI, 0.025);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < 6; j++) {
      const a = j * 2.4 + i,
        from = new T.Vector3(x, (2 + j * 0.15) * scale, z),
        to = new T.Vector3(
          x + Math.cos(a) * 1.3 * scale,
          (3.7 + j * 0.15) * scale,
          z + Math.sin(a) * 1.3 * scale,
        );
      dummy.position.copy(from).add(to).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        to.clone().sub(from).normalize(),
      );
      dummy.scale.set(scale, from.distanceTo(to), scale);
      dummy.updateMatrix();
      branches.setMatrixAt(i * 6 + j, dummy.matrix);
    }
    for (let j = 0; j < 26; j++) {
      const a = j * 2.399,
        spread = Math.sqrt(random()) * 2.05,
        size = (0.48 + random() * 0.38) * scale;
      dummy.position.set(
        x + Math.cos(a) * spread * scale,
        (3.2 +
          Math.sqrt(Math.max(0, 4.4 - spread * spread)) * 0.8 +
          random() * 0.7) *
          scale,
        z + Math.sin(a) * spread * scale,
      );
      dummy.scale.set(size * 1.35, size, size * 1.15);
      dummy.rotation.set(random(), random() * 6, random());
      dummy.updateMatrix();
      leaves.setMatrixAt(i * 26 + j, dummy.matrix);
      color.setHSL(
        0.21 + random() * 0.07,
        0.22 + random() * 0.22,
        0.22 + random() * 0.18,
      );
      leaves.setColorAt(i * 26 + j, color);
    }
  }
  leaves.castShadow = true;
  trunks.castShadow = true;
  branches.castShadow = true;
  scene.add(leaves, trunks, branches);
  const grassGeometry = new T.BufferGeometry();
  grassGeometry.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [
        -0.055, 0, 0, 0.045, 0, 0, 0.035, 0.5, 0.05, 0, 0, -0.045, 0, 0, 0.045,
        -0.07, 0.36, 0, -0.04, 0, -0.03, 0.04, 0, 0.03, 0.08, 0.28, -0.05,
      ],
      3,
    ),
  );
  grassGeometry.computeVertexNormals();
  const grass = new T.InstancedMesh(
    grassGeometry,
    new T.MeshStandardMaterial({
      color: 0x6c7b43,
      roughness: 1,
      side: T.DoubleSide,
    }),
    1400,
  );
  for (let i = 0; i < 1400; i++) {
    const angle = random() * Math.PI * 2,
      r = 11.6 + random() * 29;
    dummy.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    dummy.scale.set(0.7 + random(), 0.5 + random(), 0.7 + random());
    dummy.rotation.set(0, random() * 6, 0.1);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  scene.add(grass);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const hill = new T.Mesh(
      new T.SphereGeometry(1, 24, 12),
      new T.MeshStandardMaterial({
        color: new T.Color().setHSL(0.22, 0.17, 0.43 + i * 0.004),
        roughness: 1,
      }),
    );
    hill.position.set(Math.cos(angle) * 78, -3, Math.sin(angle) * 78);
    hill.scale.set(35, 13 + random() * 13, 31);
    scene.add(hill);
  }
  return { targets, solids, drum, stationGroups };
}
export function makeBuilder(name: string, color: number, mats: Materials) {
  const g = new T.Group(),
    shirt = new T.MeshStandardMaterial({
      color: COLORS[color % COLORS.length],
      roughness: 0.92,
      bumpMap: mats.sleeve.bumpMap,
      bumpScale: 0.002,
    });
  rounded(g, [0.48, 0.58, 0.28], [0, 1.02, 0], shirt, 0.07);
  rounded(g, [0.29, 0.34, 0.29], [0, 1.5, 0], mats.skin, 0.072);
  for (const x of [-0.16, 0.16])
    rounded(g, [0.045, 0.5, 0.012], [x, 1.03, -0.144], mats.pale, 0.004);
  rounded(g, [0.13, 0.13, 0.018], [-0.075, 1.08, -0.15], shirt, 0.012);
  rounded(g, [0.46, 0.055, 0.29], [0, 0.77, 0], mats.rubber, 0.018);
  rounded(g, [0.07, 0.042, 0.025], [0, 0.77, -0.151], mats.steel, 0.004);
  const helmet = new T.Mesh(
    new T.SphereGeometry(0.215, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mats.orange,
  );
  helmet.position.y = 1.65;
  g.add(helmet);
  cylinder(g, 0.25, 0.25, 0.035, mats.orange, [0, 1.64, 0]);
  const legs: T.Mesh[] = [];
  for (const x of [-0.14, 0.14]) {
    legs.push(rounded(g, [0.18, 0.6, 0.22], [x, 0.43, 0], mats.metal, 0.04));
    rounded(g, [0.22, 0.17, 0.35], [x, 0.1, -0.05], mats.rubber, 0.043);
    rounded(g, [0.15, 0.49, 0.17], [x * 2.5, 1.05, 0], shirt, 0.065);
    rounded(g, [0.13, 0.14, 0.14], [x * 2.5, 0.765, -0.01], mats.skin, 0.045);
  }
  for (const x of [-0.07, 0.07])
    box(g, [0.035, 0.035, 0.012], [x, 1.53, -0.151], mats.rubber);
  const tag = label(
    g,
    name,
    2.05,
    undefined,
    Math.max(0.9, name.length * 0.09),
  );
  return { group: g, legs, tag };
}
