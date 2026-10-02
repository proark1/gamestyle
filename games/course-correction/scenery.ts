import * as T from 'three';
import type { CourseState } from './types';

type MeshFactory = (geometry: T.BufferGeometry, material: T.Material) => T.Mesh;

const material = (
  color: string,
  roughness = 0.8,
  options: Partial<T.MeshStandardMaterialParameters> = {},
) => new T.MeshStandardMaterial({ color, roughness, ...options });

export function addCourseSurfaceDetails(
  world: T.Group,
  course: CourseState,
  mesh: MeshFactory,
) {
  const stripeMaterial = material('#2f925d', 0.98, {
    transparent: true,
    opacity: 0.28,
  });
  for (let z = 0.75; z < course.length; z += 1.5) {
    const stripe = mesh(
      new T.PlaneGeometry(course.width - 0.12, 0.72),
      stripeMaterial,
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.005, z);
    stripe.receiveShadow = false;
    world.add(stripe);
  }

  const seamMaterial = material('#d6d0bd', 0.95);
  const screwMaterial = material('#17354a', 0.48, { metalness: 0.36 });
  for (const x of [-course.width / 2 - 0.12, course.width / 2 + 0.12]) {
    for (let z = 0.8; z < course.length; z += 1.55) {
      const seam = mesh(new T.BoxGeometry(0.255, 0.465, 0.025), seamMaterial);
      seam.position.set(x, 0.082, z);
      world.add(seam);
      const screw = mesh(
        new T.CylinderGeometry(0.035, 0.035, 0.02, 8),
        screwMaterial,
      );
      screw.rotation.z = Math.PI / 2;
      screw.position.set(x + (x < 0 ? 0.13 : -0.13), 0.19, z - 0.28);
      world.add(screw);
    }
  }

  addHoleIdentity(world, course, mesh);
}

function addHoleIdentity(
  world: T.Group,
  course: CourseState,
  mesh: MeshFactory,
) {
  if (course.id === 'pivot-alley') {
    const sign = new T.Group();
    const post = mesh(
      new T.CylinderGeometry(0.04, 0.055, 1.1, 8),
      material('#17354a'),
    );
    post.position.y = 0.55;
    const board = mesh(new T.BoxGeometry(0.9, 0.42, 0.08), material('#f5d85c'));
    board.position.set(0, 0.96, 0);
    board.rotation.z = -0.08;
    const arrow = mesh(new T.ConeGeometry(0.13, 0.4, 3), material('#17354a'));
    arrow.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
    arrow.position.set(0.04, 0.96, -0.055);
    sign.add(post, board, arrow);
    sign.position.set(-course.width / 2 - 0.72, 0, 3.2);
    world.add(sign);
  } else if (course.id === 'tipping-point') {
    const rope = new T.Group();
    for (const x of [-course.width / 2 - 0.55, course.width / 2 + 0.55]) {
      const post = mesh(
        new T.CylinderGeometry(0.045, 0.06, 1.15, 8),
        material('#17354a'),
      );
      post.position.set(x, 0.55, 9.35);
      rope.add(post);
      for (let index = 0; index < 3; index++) {
        const pennant = mesh(
          new T.ConeGeometry(0.11, 0.3, 3),
          material(index % 2 ? '#f5d85c' : '#f26a3d'),
        );
        pennant.rotation.z = Math.PI;
        pennant.position.set(x, 1.06 - index * 0.23, 9.35);
        rope.add(pennant);
      }
    }
    world.add(rope);
  } else {
    const toolbox = new T.Group();
    const body = mesh(new T.BoxGeometry(1.05, 0.42, 0.54), material('#f26a3d'));
    body.position.y = 0.22;
    const lid = mesh(new T.BoxGeometry(1.08, 0.1, 0.58), material('#17354a'));
    lid.position.y = 0.47;
    const handle = mesh(
      new T.TorusGeometry(0.22, 0.035, 6, 12, Math.PI),
      material('#f7f4e8'),
    );
    handle.position.y = 0.62;
    toolbox.add(body, lid, handle);
    toolbox.position.set(course.width / 2 + 0.75, 0, 12.2);
    toolbox.rotation.y = -0.18;
    world.add(toolbox);
  }
}

export function addBridgeDetails(
  group: T.Group,
  bridgeWidth: number,
  mesh: MeshFactory,
) {
  const dark = material('#17354a', 0.62, { metalness: 0.18 });
  for (const x of [-bridgeWidth / 2 + 0.15, bridgeWidth / 2 - 0.15]) {
    const rail = mesh(new T.BoxGeometry(0.13, 0.08, 2.72), dark);
    rail.position.set(x, 0.24, 0);
    group.add(rail);
  }
  const pivot = mesh(
    new T.CylinderGeometry(0.18, 0.18, bridgeWidth + 0.38, 14),
    dark,
  );
  pivot.rotation.z = Math.PI / 2;
  pivot.position.y = -0.03;
  group.add(pivot);
  const stripeMaterial = material('#17354a');
  for (let x = -bridgeWidth / 2 + 0.4; x < bridgeWidth / 2; x += 0.7) {
    const stripe = mesh(new T.BoxGeometry(0.28, 0.025, 0.48), stripeMaterial);
    stripe.position.set(x, 0.225, -1.02);
    stripe.rotation.y = -0.4;
    group.add(stripe);
  }
}

export function addPlatformDetails(group: T.Group, mesh: MeshFactory) {
  const guide = mesh(
    new T.BoxGeometry(5.25, 0.1, 0.22),
    material('#17354a', 0.56, { metalness: 0.22 }),
  );
  guide.position.y = -0.08;
  group.add(guide);
  for (const x of [-0.9, 0.9]) {
    const roller = mesh(
      new T.CylinderGeometry(0.11, 0.11, 0.28, 10),
      material('#f5d85c'),
    );
    roller.rotation.z = Math.PI / 2;
    roller.position.set(x, -0.02, 0);
    group.add(roller);
  }
}
