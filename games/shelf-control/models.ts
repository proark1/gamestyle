import * as THREE from 'three';
import { worker } from '../../shared/rendering/worker';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const palette = {
  sage: 0x8fa282,
  ink: 0x385d53,
  clay: 0xc78c63,
  oak: 0xd3b07b,
  ivory: 0xf1e5c8,
  background: 0xc7d3b6,
};
export function block(
  parent: THREE.Object3D,
  size: number[],
  position: number[],
  color: number,
  rounded = true,
) {
  const mesh = new THREE.Mesh(
    rounded && Math.min(...size) > 0.08
      ? new RoundedBoxGeometry(
          size[0],
          size[1],
          size[2],
          2,
          Math.min(0.075, Math.min(...size) / 3),
        )
      : new THREE.BoxGeometry(...(size as [number, number, number])),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      flatShading: true,
    }),
  );
  mesh.position.set(...(position as [number, number, number]));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function ball(
  parent: THREE.Object3D,
  radius: number,
  y: number,
  color: number,
) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 8),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      flatShading: true,
    }),
  );
  mesh.position.y = y;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
export function sign(
  parent: THREE.Object3D,
  text: string,
  x: number,
  y: number,
  z: number,
  width = 3,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff4d7';
  ctx.beginPath();
  ctx.roundRect(0, 0, 768, 160, 22);
  ctx.fill();
  ctx.fillStyle = '#294a43';
  ctx.font = '500 60px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 384, 80, 730);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, (width * 160) / 768),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.x = -0.4;
  parent.add(mesh);
  return mesh;
}
export function itemModel(kind: 'key' | 'ladder' | 'prop') {
  const group = new THREE.Group();
  if (kind === 'ladder') {
    for (const x of [-0.35, 0.35])
      block(group, [0.09, 2.4, 0.09], [x, 1.2, 0], palette.oak);
    for (let y = 0.25; y < 2.4; y += 0.37)
      block(group, [0.8, 0.08, 0.08], [0, y, 0], palette.oak);
  } else if (kind === 'key') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.055, 8, 16),
      new THREE.MeshStandardMaterial({
        color: 0xedb953,
        metalness: 0.65,
        roughness: 0.3,
      }),
    );
    ring.position.y = 0.55;
    group.add(ring);
    block(group, [0.065, 0.38, 0.065], [0, 0.28, 0], 0xedb953);
    block(group, [0.16, 0.07, 0.07], [0.055, 0.14, 0], 0xedb953);
  } else {
    block(group, [0.48, 0.4, 0.4], [0, 0.24, 0], palette.clay);
    block(group, [0.5, 0.07, 0.42], [0, 0.47, 0], palette.ivory);
  }
  return group;
}
export function mannequin(guard = false) {
  // This is the same geometry and rig used by the farmer and delivery crew.
  const group = worker(guard ? 1 : 0);
  const materials = new Map<THREE.Material, THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const original = object.material as THREE.MeshStandardMaterial;
    let owned = materials.get(original);
    if (!owned) {
      const material = original.clone();
      if (!guard && original.color.getHexString() !== '283b34') {
        material.color.setHex(palette.oak);
      }
      owned = material;
      materials.set(original, owned);
    }
    object.material = owned;
  });
  const torso = group.userData.body as THREE.Group;
  const limbs = ['armL', 'armR', 'legL', 'legR'].map(
    (name) => group.userData[name] as THREE.Group,
  );
  const carry = new THREE.Group();
  carry.position.set(0.48, 0.8, 0.25);
  torso.add(carry);
  if (guard) {
    block(torso, [0.12, 0.12, 0.035], [0.16, 1.08, 0.295], 0xf3bf50);
    block(torso, [0.13, 0.13, 0.35], [0.44, 0.8, 0.38], 0x444a50);
    const lens = ball(torso, 0.09, 0.8, 0xffedaf);
    lens.position.set(0.44, 0.8, 0.59);
  }
  return { group, torso, limbs, carry };
}
/** Small shelf-top props follow the same matte, low-poly scenery as the farm. */
export function shelfPlant(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  block(group, [0.4, 0.34, 0.4], [0, 0.17, 0], palette.clay);
  for (const side of [-1, 0, 1]) {
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.29, 0),
      new THREE.MeshStandardMaterial({
        color: side === 0 ? 0x7b9368 : 0x9aaa70,
        roughness: 0.9,
        flatShading: true,
      }),
    );
    leaf.position.set(side * 0.15, 0.51, 0);
    leaf.scale.set(0.75, 1.35, 0.75);
    leaf.rotation.z = -side * 0.45;
    leaf.castShadow = true;
    group.add(leaf);
  }
  parent.add(group);
}
export type Doll = ReturnType<typeof mannequin>;
export function animateDoll(
  doll: Doll,
  pose: number,
  moving: boolean,
  time: number,
  carrying: boolean,
) {
  const swing = moving ? Math.sin(time * 9) * 0.48 : 0;
  doll.limbs.forEach((joint, i) => {
    joint.rotation.set(
      i < 2 ? -swing * (i ? 1 : -1) : swing * (i === 2 ? 1 : -1),
      0,
      0,
    );
  });
  if (!moving) {
    doll.limbs[0].rotation.z = pose === 1 ? -2.25 : pose === 2 ? -0.8 : -0.08;
    doll.limbs[1].rotation.z = pose === 1 ? 0.5 : pose === 2 ? 2.4 : 0.08;
  }
  if (carrying) doll.limbs[1].rotation.x = -1.3;
  doll.torso.rotation.z = !moving && pose === 2 ? 0.12 : 0;
}
