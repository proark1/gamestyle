import test from 'node:test';
import assert from 'node:assert/strict';
import { GameScene, eyeMovement } from './scene';
import { TouchGesture } from './touch';
import * as T from 'three';
import { applyAction, freshWorld } from './model';
import { playerBlocksPlacement } from './placement';
import { pieceBase, stairHeight, walkSurfaces } from './levels';
import { SitePhysics } from './physics';
import { makePiece, disposePiece } from './objects';

// Exercise the real resize methods without requiring a GPU in the unit-test process.
function fixture() {
  const scene = Object.create(GameScene.prototype) as GameScene;
  const host = { clientWidth: 390, clientHeight: 634 };
  const sizes: number[][] = [];
  let ratio = 1,
    cameras = 0;
  Object.assign(scene, {
    host,
    width: 390,
    height: 634,
    pixelRatio: 1,
    resizePending: false,
    renderer: {
      getPixelRatio: () => ratio,
      setDrawingBufferSize: (w: number, h: number, r: number) => {
        sizes.push([w, h, r]);
        ratio = r;
      },
    },
    updateCamera: () => {
      cameras++;
    },
    touch: { x: 0.7, z: -0.5 },
    keys: new Set(['KeyW']),
    gestures: new TouchGesture(),
  });
  scene.gestures.down(2, 20, 20, 0);
  return { scene, host, sizes, cameras: () => cameras };
}

void test('resize notifications keep the current image and held input until the next frame', () => {
  const f = fixture();
  for (let i = 0; i < 120; i++) {
    f.host.clientHeight = 634 - i;
    f.scene.onResize();
  }
  assert.equal(f.sizes.length, 0); // ResizeObserver must never clear the drawing buffer.
  assert.deepEqual(f.scene.touch, { x: 0.7, z: -0.5 });
  assert.equal(f.scene.keys.has('KeyW'), true);
  assert.equal(f.scene.gestures.contacts.size, 1);
  f.scene.applyResize();
  assert.deepEqual(f.sizes, [[390, 515, 1]]); // Only the last size is applied in the frame.
  assert.equal(f.cameras(), 1);
  assert.deepEqual(f.scene.touch, { x: 0.7, z: -0.5 });
});

void test('unchanged sizes and empty layout passes never clear the drawing buffer', () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) {
    f.scene.onResize();
    f.scene.applyResize();
  }
  f.host.clientHeight = 0;
  f.scene.onResize();
  f.scene.applyResize();
  assert.equal(f.sizes.length, 0);
  assert.equal(f.scene.height, 634);
  f.host.clientHeight = 420;
  f.scene.onResize();
  f.scene.applyResize();
  f.scene.applyResize();
  assert.deepEqual(f.sizes, [[390, 420, 1]]);
});

void test('orientation and render-quality changes update one buffer and preserve active contacts', () => {
  const f = fixture();
  f.host.clientWidth = 844;
  f.host.clientHeight = 276;
  f.scene.pixelRatio = 1.15;
  f.scene.onResize();
  f.scene.applyResize();
  assert.deepEqual(f.sizes, [[844, 276, 1.15]]);
  f.scene.onResize();
  f.scene.applyResize();
  assert.equal(f.sizes.length, 1);
  assert.equal(f.scene.gestures.contacts.size, 1);
  f.scene.pixelRatio = 1.6;
  f.scene.onResize();
  f.scene.applyResize();
  assert.deepEqual(f.sizes.at(-1), [844, 276, 1.6]);
});

function buildFixture() {
  const scene = Object.create(GameScene.prototype) as GameScene;
  const clicked: { x: number; z: number }[] = [];
  const camera = new T.OrthographicCamera(-8, 8, 6, -6, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  Object.assign(scene, {
    scene: new T.Scene(),
    camera,
    host: {
      style: {},
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    },
    local: {
      id: 'p',
      name: 'Meister',
      x: 0,
      z: 4,
      y: 0.43,
      angle: 0,
      color: 0,
      seen: 1000,
    },
    snapshot: {
      world: { ...freshWorld('sandbox', 1000), pieces: [] },
      players: [],
    },
    callbacks: {
      click: (x: number, z: number) => clicked.push({ x, z }),
      feedback: () => {},
    },
    menu: false,
    paused: false,
    touchMode: true,
    hovering: false,
    aim: null,
    ghost: null,
    buildKind: null,
    rotation: 0,
    demolish: false,
    pointer: new T.Vector2(-20, -20),
    ray: new T.Raycaster(),
    target: new T.Vector3(),
    plane: new T.Plane(new T.Vector3(0, 1, 0), -0.43),
    gestures: new TouchGesture(),
    drag: null,
    buildBase: new T.Mesh(new T.PlaneGeometry(), new T.MeshBasicMaterial()),
    buildReach: new T.Mesh(new T.RingGeometry(), new T.MeshBasicMaterial()),
    buildLink: new T.Line(new T.BufferGeometry(), new T.LineDashedMaterial()),
    buildJoints: [],
    pieces: new Map(),
    route: [],
    work: null,
  });
  scene.setTool('floor', 0);
  return { scene, clicked };
}

void test('mouse hover shows the selected model in a compact window and tap submits that same target', () => {
  const { scene, clicked } = buildFixture();
  scene.updateBuildPreview();
  assert.equal(scene.ghost!.visible, false);
  scene.updatePointer({
    pointerType: 'mouse',
    clientX: 400,
    clientY: 300,
    pointerId: 1,
  } as PointerEvent);
  scene.updateBuildPreview();
  assert.equal(scene.ghost!.visible, true);
  assert.ok(scene.buildPreview);
  const preview = scene.buildPreview!;
  scene.tap();
  assert.deepEqual(clicked, [{ x: preview.x, z: preview.z }]);
  scene.snapshot!.world.pieces.push({
    id: 'occupied',
    kind: 'floor',
    x: preview.x,
    z: preview.z,
    rotation: 0,
    placed: true,
  });
  scene.updateBuildPreview();
  assert.equal(scene.ghost!.visible, true);
  assert.match(scene.buildPreview!.error!, /overlap/);
});

void test('genuine touch keeps a selected preview after the contact leaves the canvas', () => {
  const { scene } = buildFixture();
  scene.updatePointer({
    pointerType: 'touch',
    clientX: 400,
    clientY: 300,
    pointerId: 2,
  } as PointerEvent);
  scene.updateBuildPreview();
  assert.equal(scene.ghost!.visible, false);
  scene.aim = { x: 2, z: 2 };
  scene.pointer.set(-20, -20);
  scene.updateBuildPreview();
  assert.equal(scene.ghost!.visible, true);
  assert.equal(scene.buildPreview!.x, 2);
  assert.equal(scene.buildPreview!.z, 2);
});

void test('a ground floor preview behind a wall stays occluded instead of appearing on the wall top', () => {
  const { scene } = buildFixture();
  scene.aim = { x: 0, z: -6 };
  scene.updateBuildPreview();
  assert.equal(scene.buildPreview!.level ?? 0, 0);
  assert.ok(scene.ghost!.position.y < 0.3);
  const wall = makePiece('wall');
  wall.position.set(0, 0.43, -4);
  wall.updateMatrixWorld(true);
  scene.ghost!.updateMatrixWorld(true);
  const center = new T.Box3()
    .setFromObject(scene.ghost!)
    .getCenter(new T.Vector3());
  const ray = new T.Raycaster(
    scene.camera.position,
    center.sub(scene.camera.position).normalize(),
  );
  const wallHit = ray.intersectObject(wall, true)[0],
    floorHit = ray.intersectObject(scene.ghost!, true)[0];
  assert.ok(wallHit && floorHit && wallHit.distance < floorHit.distance);
  scene.ghost!.traverse((object) => {
    if (!(object instanceof T.Mesh || object instanceof T.Line)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      assert.equal(
        material.depthTest,
        true,
        'Floor surfaces and outlines must respect the nearer wall',
      );
  });
  disposePiece(wall);
});

void test('floor preview and constructed tile have matching heights on every selected storey', () => {
  for (const level of [0, 1, 2]) {
    for (const rotation of [0, 1, 2, 3]) {
      const { scene } = buildFixture(),
        world = scene.snapshot!.world,
        player = scene.local!;
      world.pieces = [
        {
          id: 'support',
          kind: 'wall',
          x: 2,
          z: -1,
          level: Math.max(0, level - 1),
          rotation: 0,
          placed: true,
        },
      ];
      Object.assign(player, {
        x: 2,
        z: 1.5,
        y: 0.43 + Math.max(0, level - 1) * 3,
      });
      scene.setTool('floor', rotation, false, level);
      scene.aim = { x: 2, z: 0, level };
      scene.updateBuildPreview();
      const preview = scene.buildPreview!;
      assert.equal(preview.error, null);
      assert.equal(preview.level ?? 0, level);
      assert.equal(preview.reachable, true);
      const previewBounds = new T.Box3().setFromObject(scene.ghost!);
      applyAction(
        world,
        { type: 'build', kind: 'floor', ...preview },
        player,
        [player],
        player.id,
        1100,
      );
      const placed = world.pieces.at(-1)!;
      assert.equal(placed.level ?? 0, level);
      assert.equal(placed.x, preview.x);
      assert.equal(placed.z, preview.z);
      const mesh = makePiece('floor');
      mesh.position.set(placed.x, pieceBase(placed, world.map), placed.z);
      mesh.rotation.y = (placed.rotation * Math.PI) / 2;
      const placedBounds = new T.Box3().setFromObject(mesh);
      assert.ok(
        Math.abs(previewBounds.min.y - placedBounds.min.y - 0.02) < 1e-6,
      );
      assert.ok(
        Math.abs(previewBounds.max.y - placedBounds.max.y - 0.02) < 1e-6,
      );
      disposePiece(mesh);
    }
  }
});

void test('stairs preview survives mouse hover, rotates, and shows reachable, distant and blocked targets', () => {
  const { scene, clicked } = buildFixture();
  scene.setTool('stairs', 0);
  scene.local!.z = 2.5;
  scene.updatePointer({
    pointerType: 'mouse',
    clientX: 400,
    clientY: 300,
    pointerId: 1,
  } as PointerEvent);
  scene.updateBuildPreview();
  assert.equal(scene.ghost!.visible, true);
  assert.equal(scene.buildPreview!.error, null);
  assert.equal(scene.buildPreview!.reachable, true);
  const arrow = scene.ghost!.children.find(
    (o) => o instanceof T.ArrowHelper,
  ) as T.ArrowHelper;
  assert.ok(arrow);
  const arrowMaterial = arrow.cone.material as T.MeshBasicMaterial;
  assert.equal(arrowMaterial.color.getHexString(), '36bd86');
  assert.equal((arrow.line.material as T.LineBasicMaterial).depthTest, false);
  scene.tap();
  assert.deepEqual(clicked, [
    { x: scene.buildPreview!.x, z: scene.buildPreview!.z },
  ]);
  scene.local!.z = 5;
  scene.updateBuildPreview();
  assert.equal(scene.buildPreview!.reachable, false);
  assert.equal(arrowMaterial.color.getHexString(), 'f0b83f');
  for (let rotation = 0; rotation < 4; rotation++) {
    scene.setTool('stairs', rotation);
    scene.updateBuildPreview();
    assert.equal(scene.ghost!.rotation.y, (rotation * Math.PI) / 2);
    assert.equal(scene.ghost!.visible, true);
  }
  scene.snapshot!.world.pieces.push({
    id: 'occupied',
    kind: 'chair',
    x: 0,
    z: 0,
    rotation: 0,
    placed: true,
  });
  scene.updateBuildPreview();
  assert.match(scene.buildPreview!.error!, /overlap/);
  assert.equal(scene.ghost!.visible, true);
  assert.equal(arrowMaterial.color.getHexString(), 'e3695b');
});

void test('stairs retain their touch preview and explain unsupported upper-floor placement', () => {
  const { scene } = buildFixture();
  scene.setTool('stairs', 1, false, 1);
  scene.aim = { x: 0, z: 0 };
  scene.updateBuildPreview();
  assert.equal(scene.ghost!.visible, true);
  assert.equal(scene.buildPreview!.level, 1);
  assert.match(scene.buildPreview!.error!, /floor tiles/);
  assert.ok(scene.ghost!.position.y > 3.43);
  scene.pointer.set(-20, -20);
  scene.updateBuildPreview();
  assert.equal(scene.ghost!.visible, true);
  scene.setTool('wall', 0);
  scene.updateBuildPreview();
  assert.equal(scene.buildKind, 'wall');
});

function finger(id: number, x: number, y: number, at: number) {
  return {
    pointerId: id,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
    timeStamp: at,
  } as PointerEvent;
}
function touchBuildFixture() {
  const f = buildFixture(),
    actions: string[] = [],
    positions: { x: number; z: number }[] = [];
  Object.assign(f.scene, {
    yaw: 0.53,
    zoom: 1,
    pan: { x: 0, z: 0 },
    overviewCamera: f.scene.camera,
    width: 800,
    updateCamera: () => {},
  });
  f.scene.callbacks.action = (action) => actions.push(action);
  f.scene.callbacks.positionBuild = (x, z) => positions.push({ x, z });
  return { ...f, actions, positions };
}
function grip(scene: GameScene, id: number, at: number) {
  scene.updateBuildPreview();
  const point = scene.buildHandlePoint()!;
  assert.ok(point, 'A staged preview has a visible grip');
  const contact = finger(id, point.x, point.y, at);
  scene.updatePointer(contact);
  scene.gestures.down(id, point.x, point.y, at);
  scene.beginBuildDrag(contact);
  assert.equal(scene.buildDrag?.id, id);
  return point;
}
void test('mobile world taps only stage or reposition; dragging the marked grip never commits a build', () => {
  const { scene, clicked, positions, actions } = touchBuildFixture();
  scene.gestures.down(1, 400, 300, 0);
  scene.releaseTouch(finger(1, 400, 300, 100));
  assert.equal(clicked.length, 1);
  assert.ok(scene.aim);
  assert.deepEqual(actions, []);
  const point = grip(scene, 2, 200);
  scene.updatePointer(finger(2, point.x + 90, point.y + 40, 240));
  assert.ok(positions.length);
  assert.notDeepEqual(scene.aim, clicked[0]);
  assert.equal(scene.yaw, 0.53);
  scene.updateBuildPreview();
  assert.equal(scene.buildPreview!.x, scene.aim!.x);
  assert.equal(scene.buildPreview!.z, scene.aim!.z);
  const positioned = { ...scene.aim! };
  scene.releaseTouch(finger(2, point.x + 90, point.y + 40, 280));
  assert.deepEqual(actions, []);
  // Implicit capture loss after a successful release must not cancel the staged position.
  scene.releaseTouch(finger(2, point.x + 90, point.y + 40, 281), true);
  assert.equal(scene.touchBuildReady, true);
  scene.gestures.down(3, 300, 250, 400);
  scene.releaseTouch(finger(3, 300, 250, 470));
  assert.deepEqual(actions, []);
  assert.notDeepEqual(scene.aim, positioned);
  assert.equal(clicked.length, 2);
});
void test('pinching a staged build changes the camera without moving or placing the piece', () => {
  const { scene, positions, actions } = touchBuildFixture();
  scene.aim = { x: 2, z: 2 };
  scene.gestures.down(1, 300, 300, 0);
  scene.gestures.down(2, 400, 300, 10);
  scene.updatePointer(finger(2, 450, 300, 40));
  assert.equal(scene.zoom, 1.5);
  assert.deepEqual(positions, []);
  scene.releaseTouch(finger(2, 450, 300, 70));
  scene.updatePointer(finger(1, 340, 300, 80));
  scene.releaseTouch(finger(1, 340, 300, 100));
  assert.deepEqual(actions, []);
  assert.deepEqual(scene.aim, { x: 2, z: 2 });
  assert.equal(scene.yaw, 0.53);
});
void test('cancelled placement drags cannot confirm, and changing tools clears the staged gesture', () => {
  const { scene, actions } = touchBuildFixture();
  scene.aim = { x: 2, z: 2 };
  const point = grip(scene, 1, 0);
  scene.updatePointer(finger(1, point.x + 60, point.y + 30, 30));
  assert.equal(scene.touchBuildReady, true);
  scene.releaseTouch(finger(1, 460, 330, 40), true);
  assert.equal(scene.touchBuildReady, false);
  assert.deepEqual(actions, []);
  scene.gestures.down(2, 400, 300, 80);
  scene.setTool('wall', 0);
  assert.equal(scene.aim, null);
  assert.equal(scene.gestures.contacts.size, 0);
  scene.releaseTouch(finger(2, 400, 300, 120));
  assert.deepEqual(actions, []);
});
void test('dragging a build cancels the approach route and keeps blocked placement visible', () => {
  const { scene } = touchBuildFixture();
  scene.aim = { x: 0, z: 0 };
  scene.route = [{ x: 1, z: 1 }];
  scene.work = {
    target: { x: 0, z: 0 },
    run: () => assert.fail('A preview cannot build'),
    label: 'Approach',
    started: 0,
    part: { kind: 'floor', rotation: 0 },
  };
  const point = grip(scene, 1, 0);
  scene.updatePointer(finger(1, point.x + 60, point.y + 30, 30));
  assert.equal(scene.work, null);
  assert.deepEqual(scene.route, []);
  scene.snapshot!.world.pieces.push({
    id: 'occupied',
    kind: 'floor',
    ...scene.aim!,
    rotation: 0,
    placed: true,
  });
  scene.updateBuildPreview();
  assert.equal(scene.ghost!.visible, true);
  assert.ok(scene.buildPreview!.error);
});
void test('touch building in first person positions a world-space preview without turning the camera', () => {
  const { scene, actions } = touchBuildFixture();
  Object.assign(scene, {
    firstPerson: true,
    craneMode: false,
    eyeYaw: Math.PI,
    pitch: -0.5,
    root: new T.Group(),
  });
  scene.camera = new T.PerspectiveCamera(75, 800 / 600, 0.06, 100);
  scene.camera.position.set(0, 3, 5);
  scene.camera.lookAt(0, 0, 0);
  scene.camera.updateMatrixWorld();
  scene.gestures.down(1, 400, 300, 0);
  scene.releaseTouch(finger(1, 400, 300, 100));
  assert.ok(scene.aim);
  const point = grip(scene, 2, 200);
  scene.updatePointer(finger(2, point.x + 100, point.y + 50, 240));
  scene.releaseTouch(finger(2, point.x + 100, point.y + 50, 280));
  assert.equal(scene.eyeYaw, Math.PI);
  assert.equal(scene.pitch, -0.5);
  assert.deepEqual(actions, []);
  const target = { ...scene.aim! };
  scene.camera.position.x += 1;
  scene.camera.updateMatrixWorld();
  scene.updateBuildPreview();
  assert.equal(scene.buildPreview!.x, target.x);
  assert.equal(scene.buildPreview!.z, target.z);
});

void test('dragging away from the build grip or adding another finger operates only the camera', () => {
  const { scene, positions, actions } = touchBuildFixture();
  scene.aim = { x: 0, z: 0 };
  scene.updateBuildPreview();
  scene.gestures.down(1, 30, 50, 0);
  scene.updatePointer(finger(1, 90, 60, 60));
  assert.notEqual(scene.yaw, 0.53);
  assert.deepEqual(scene.aim, { x: 0, z: 0 });
  scene.releaseTouch(finger(1, 90, 60, 70));
  const point = grip(scene, 2, 100);
  scene.gestures.down(3, point.x + 100, point.y, 110);
  scene.updatePointer(finger(3, point.x + 150, point.y, 160));
  assert.equal(scene.buildDrag, null);
  scene.releaseTouch(finger(2, point.x, point.y, 170));
  scene.releaseTouch(finger(3, point.x + 150, point.y, 180));
  assert.deepEqual(positions, []);
  assert.deepEqual(actions, []);
});

void test('touch carry aim survives walking and orbiting, and mouse input restores movement facing', () => {
  const { scene } = touchBuildFixture();
  scene.snapshot!.world.pieces.push({
    id: 'held',
    kind: 'chair',
    x: 0,
    z: 0,
    placed: false,
    heldBy: scene.local!.id,
    rotation: 0,
  });
  scene.carryAim = Math.PI / 2;
  scene.faceMovement(0, -1);
  assert.equal(scene.local!.angle, Math.PI / 2);
  scene.cameraAction('right');
  scene.faceMovement(-1, 0);
  assert.equal(scene.local!.angle, Math.PI / 2);
  scene.setTouchInput(false);
  scene.faceMovement(-1, 0);
  assert.equal(scene.local!.angle, -Math.PI / 2);
});

void test('a worker standing in a planned wall walks out before the build can execute', () => {
  const { scene } = buildFixture();
  scene.local!.x = 0;
  scene.local!.z = 0;
  let builds = 0;
  scene.goTo({ x: 0, z: 0 }, () => builds++, 'Bauen', undefined, {
    kind: 'wall',
    rotation: 0,
  });
  assert.equal(builds, 0);
  assert.ok(scene.route.length > 1);
  scene.setTool('wall', 0);
  scene.updateBuildPreview();
  assert.equal(scene.ghost!.visible, true);
  assert.equal(scene.buildPreview!.x, 0);
  const end = scene.route.at(-1)!;
  assert.equal(playerBlocksPlacement('wall', { x: 0, z: 0 }, 0, end), false);
  Object.assign(scene.local!, end);
  assert.equal(
    scene.canWork({ x: 0, z: 0 }, undefined, { kind: 'wall', rotation: 0 }),
    true,
  );
});

void test('a worker on the stairs approaches the first landing slab within actual building reach', () => {
  const { scene } = buildFixture(),
    world = scene.snapshot!.world,
    player = scene.local!,
    target = { x: 0, z: -3, level: 1 },
    part = { kind: 'floor' as const, rotation: 0 },
    feedback: string[] = [];
  world.pieces = [
    { id: 'stairs', kind: 'stairs', x: 0, z: 0, rotation: 0, placed: true },
  ];
  Object.assign(player, { x: 0, z: 0.5 });
  player.y = stairHeight(world.pieces[0], player)!;
  scene.callbacks.feedback = (message) => feedback.push(message);
  const build = () =>
    applyAction(
      world,
      { type: 'build', ...part, ...target },
      player,
      [player],
      player.id,
      1100,
    );
  assert.equal(scene.canWork(target, undefined, part), false);
  scene.goTo(target, build, 'Build floor', undefined, part);
  assert.deepEqual(feedback, []);
  assert.ok(scene.route.length > 1);
  assert.ok(scene.work);
  assert.equal(world.pieces.length, 1, 'The landing has not been built yet');
  for (const step of scene.route)
    assert.ok(
      walkSurfaces(world, step).some((y) => Math.abs(y - step.y!) < 0.01),
      'Every route step has support before the landing is built',
    );
  const physics = new SitePhysics(),
    route = [...scene.route];
  physics.sync(world.pieces, [player], player.id);
  for (let i = 0; i < 600; i++) {
    Object.assign(player, physics.playerPosition(player.id)!);
    if (scene.canWork(target, undefined, part)) break;
    while (
      route[0] &&
      Math.hypot(route[0].x - player.x, route[0].z - player.z) < 0.2 &&
      Math.abs(route[0].y! - player.y!) < 0.55
    )
      route.shift();
    assert.ok(
      route[0],
      'The worker must be able to build by the end of the route',
    );
    const dx = route[0].x - player.x,
      dz = route[0].z - player.z,
      distance = Math.hypot(dx, dz);
    physics.move(player.id, (dx / distance) * 4.3, (dz / distance) * 4.3);
    physics.step(1 / 60);
  }
  assert.equal(scene.canWork(target, undefined, part), true);
  scene.goTo(target, build, 'Build floor', undefined, part);
  assert.equal(world.pieces.at(-1)!.kind, 'floor');
  assert.equal(world.pieces.at(-1)!.level, 1);
  assert.deepEqual(feedback, []);
});

void test('a distant worker approaches an overhead floor along the ground', () => {
  const { scene } = buildFixture(),
    target = { x: 2, z: -3, level: 1 },
    part = { kind: 'floor' as const, rotation: 0 };
  scene.snapshot!.world.pieces = [
    { id: 'support', kind: 'wall', x: 2, z: -4, rotation: 0, placed: true },
  ];
  let builds = 0;
  scene.goTo(target, () => builds++, 'Build floor', undefined, part);
  assert.equal(builds, 0);
  assert.ok(scene.route.length > 1);
  assert.ok(scene.route.every((p) => (p.y ?? 0.43) < 0.9));
  Object.assign(scene.local!, scene.route.at(-1)!);
  assert.equal(scene.canWork(target, undefined, part), true);
});

void test('floor work cannot find a route through enclosing walls or build two storeys above ground', () => {
  for (const level of [1, 2]) {
    const { scene } = buildFixture(),
      feedback: string[] = [],
      target = { x: 0, z: 0, level };
    Object.assign(scene.local!, { x: 0, z: 3 });
    scene.snapshot!.world.pieces = [-2, 0, 2].flatMap((offset) =>
      [
        { x: offset, z: -2, rotation: 0 },
        { x: offset, z: 2, rotation: 0 },
        { x: -2, z: offset, rotation: 1 },
        { x: 2, z: offset, rotation: 1 },
      ].map((wall, i) => ({
        ...wall,
        id: `wall-${offset}-${i}`,
        kind: 'wall' as const,
        placed: true,
        level: level - 1,
      })),
    );
    scene.callbacks.feedback = (message) => feedback.push(message);
    let builds = 0;
    scene.goTo(target, () => builds++, 'Build floor', undefined, {
      kind: 'floor',
      rotation: 0,
    });
    assert.equal(builds, 0);
    assert.equal(scene.route.length, 0);
    assert.equal(scene.work, null);
    assert.match(feedback[0], /No clear path/);
  }
});

void test('roof fade reveals indoor contents, restores opacity and never mutates shared materials', async () => {
  const { makePiece, disposePiece } = await import('./objects');
  const { prepareRoof, fadeRoof, underRoof } = await import('./roof-view');
  const roof = makePiece('roof'),
    other = makePiece('roof');
  const shared = (other.children[0] as T.Mesh)
    .material as T.MeshStandardMaterial;
  prepareRoof(roof);
  for (let i = 0; i < 60; i++) fadeRoof(roof, true, 1 / 60);
  const mesh = roof.children[0] as T.Mesh,
    material = mesh.material as T.MeshStandardMaterial;
  assert.equal(material.opacity, 0.17);
  assert.equal(material.depthWrite, false);
  assert.equal(mesh.castShadow, false);
  assert.equal(shared.opacity, 1);
  assert.equal((mesh.userData.roofEdges as T.Object3D).visible, true);
  for (let i = 0; i < 60; i++) fadeRoof(roof, false, 1 / 60);
  assert.equal(material.opacity, 1);
  assert.equal(material.transparent, false);
  assert.equal(mesh.castShadow, true);
  assert.equal(
    underRoof(
      { id: 'r', kind: 'roof', placed: true, rotation: 0, x: 2, z: 2 },
      { x: 2, z: 2 },
    ),
    true,
  );
  assert.equal(
    underRoof(
      { id: 'r', kind: 'roof', placed: false, rotation: 0, x: 2, z: 2 },
      { x: 2, z: 2 },
    ),
    false,
  );
  disposePiece(roof);
  disposePiece(other);
});

void test('normal selection reaches furniture through a roof while the crane selects the roof', async () => {
  const { makePiece } = await import('./objects');
  const { scene } = buildFixture();
  scene.setTool(null, 0);
  scene.snapshot!.world.pieces = [
    { id: 'r', kind: 'roof', x: 0, z: 0, rotation: 0, placed: true },
    { id: 'chair', kind: 'chair', x: 0, z: 0, rotation: 0, placed: true },
  ];
  for (const p of scene.snapshot!.world.pieces) {
    const obj = makePiece(p.kind);
    obj.userData.id = p.id;
    obj.position.set(p.x, 0.43, p.z);
    scene.pieces.set(p.id, obj);
    obj.updateMatrixWorld(true);
  }
  scene.camera.position.set(0, 10, 0);
  scene.camera.up.set(0, 0, -1);
  scene.camera.lookAt(0, 0, 0);
  scene.camera.updateMatrixWorld(true);
  scene.pointer.set(0, 0);
  const ids: (string | undefined)[] = [];
  scene.callbacks.click = (_x, _z, id) => ids.push(id);
  scene.tap();
  assert.equal(ids.at(-1), 'chair');
  scene.craneMode = true;
  scene.tap();
  assert.equal(ids.at(-1), 'r');
});

void test('the selected storey is opaque while every other floor, wall and roof remains visible', async () => {
  const { prepareRoof } = await import('./roof-view');
  const { scene } = buildFixture();
  scene.snapshot!.world.pieces = [0, 1, 2].flatMap((level) =>
    (['floor', 'wall', 'roof'] as const).map((kind) => ({
      id: `${kind}-${level}`,
      kind,
      level,
      x: 0,
      z: 0,
      rotation: 0,
      placed: true,
    })),
  );
  for (const piece of scene.snapshot!.world.pieces) {
    const object = makePiece(piece.kind);
    if (piece.kind === 'roof') prepareRoof(object);
    object.visible = false;
    scene.pieces.set(piece.id, object);
  }
  try {
    for (const level of [0, 1, 2, 0]) {
      scene.setTool('wall', 0, false, level);
      for (let i = 0; i < 60; i++) scene.updateStoreys(1 / 60);
      for (const piece of scene.snapshot!.world.pieces) {
        const object = scene.pieces.get(piece.id)!;
        assert.equal(object.visible, true, piece.id);
        object.traverse((mesh) => {
          if (!(mesh instanceof T.Mesh)) return;
          const material = mesh.material as T.Material;
          assert.equal(
            material.opacity,
            piece.level === level ? 1 : 0.17,
            `${piece.id} selected ${level}`,
          );
          assert.equal(material.depthWrite, piece.level === level);
        });
      }
    }
    scene.menu = true;
    for (let i = 0; i < 60; i++) scene.updateStoreys(1 / 60);
    for (const object of scene.pieces.values())
      object.traverse((mesh) => {
        if (mesh instanceof T.Mesh)
          assert.equal((mesh.material as T.Material).opacity, 1);
      });
  } finally {
    for (const object of scene.pieces.values()) disposePiece(object);
    if (scene.ghost) disposePiece(scene.ghost, true);
  }
});

void test('crane roof preview rejects covered storeys and turns valid on the exposed top floor', () => {
  const { scene } = buildFixture();
  scene.craneMode = true;
  scene.snapshot!.world.pieces = [0, 1, 2].flatMap((level) => [
    {
      id: `wall-${level}`,
      kind: 'wall' as const,
      x: 0,
      z: -1,
      level,
      rotation: 0,
      placed: true,
    },
    {
      id: `tile-${level}`,
      kind: 'floor' as const,
      x: 0,
      z: 0,
      level,
      rotation: 0,
      placed: true,
    },
  ]);
  for (const level of [0, 1, 2, 0]) {
    scene.setTool('roof', 0, false, level);
    scene.aim = { x: 0, z: 0, level };
    scene.updateBuildPreview();
    const preview = scene.buildPreview!;
    assert.ok(scene.ghost!.visible);
    assert.equal(preview.level ?? 0, level);
    assert.equal(
      scene.ghost!.position.y,
      pieceBase({ id: 'preview', kind: 'roof', ...preview, placed: true }) +
        0.02,
    );
    if (level < 2) assert.match(preview.error!, /Blocked from above/);
    else assert.equal(preview.error, null);
  }
  scene.setTool(null, 0);
});

void test('picking passes through transparent storeys and selects only the chosen floor', () => {
  const { scene } = buildFixture();
  scene.setTool(null, 0, false, 0, {}, true);
  scene.snapshot!.world.pieces = [0, 1, 2].map((level) => ({
    id: `floor-${level}`,
    kind: 'floor',
    level,
    x: 0,
    z: 0,
    rotation: 0,
    placed: true,
  }));
  for (const piece of scene.snapshot!.world.pieces) {
    const object = makePiece(piece.kind);
    object.userData.id = piece.id;
    object.position.set(0, pieceBase(piece), 0);
    object.updateMatrixWorld(true);
    scene.pieces.set(piece.id, object);
  }
  scene.camera.position.set(0, 15, 0);
  scene.camera.up.set(0, 0, -1);
  scene.camera.lookAt(0, 0, 0);
  scene.camera.updateMatrixWorld(true);
  scene.pointer.set(0, 0);
  const ids: (string | undefined)[] = [];
  scene.callbacks.click = (_x, _z, id) => ids.push(id);
  try {
    for (const level of [0, 1, 2, 0]) {
      scene.setTool(null, 0, false, level, {}, true);
      scene.updateStoreys(1 / 60);
      scene.tap();
      assert.equal(ids.at(-1), `floor-${level}`);
    }
  } finally {
    for (const object of scene.pieces.values()) disposePiece(object);
  }
});

void test('crane animation lowers to ground stock, lifts clear of walls and seats at roof height', async () => {
  const { cranePose, roofSupplies, roofBase, craneReach, PICKUP_MS, PLACE_MS } =
    await import('./crane');
  const origin = roofSupplies()[0];
  const crane = {
    operatorId: 'p',
    pieceId: 'r',
    phase: 'pickup' as const,
    at: 0,
    origin,
    from: { x: origin.x, z: origin.z, y: roofBase(origin) },
  };
  const start = cranePose(crane, 0),
    attached = cranePose(crane, 1600),
    lifted = cranePose(crane, PICKUP_MS);
  assert.equal(start.y, roofBase(origin));
  assert.ok(start.hookY > attached.hookY);
  assert.equal(lifted.y, 2);
  const placed = cranePose(
    { ...crane, phase: 'placing', to: { x: -3, z: -3, rotation: 0 } },
    PLACE_MS,
  );
  assert.deepEqual([placed.x, placed.z], [-3, -3]);
  assert.ok(Math.abs(placed.y - 0.43) < 1e-9);
  for (const x of [-4.5, 4.5])
    for (const z of [-5, 4]) assert.equal(craneReach({ x, z }), true);
});

void test('first-person camera follows eye height, looks in facing direction, and restores overhead for the crane', () => {
  const scene = Object.create(GameScene.prototype) as GameScene;
  Object.assign(scene, {
    firstPerson: true,
    menu: false,
    craneMode: false,
    local: { x: 2, z: 3, y: 0.43, angle: Math.PI },
    eyeYaw: Math.PI,
    pitch: 0,
    width: 1200,
    height: 800,
    eyeCamera: new T.PerspectiveCamera(75, 1, 0.06, 200),
    overviewCamera: new T.OrthographicCamera(),
    touchMode: false,
    snapshot: { world: freshWorld() },
    pan: { x: 0, z: 0 },
    yaw: 0.53,
    zoom: 1,
    pointer: new T.Vector2(),
  });
  scene.updateCamera();
  assert.equal(scene.camera, scene.eyeCamera);
  assert.ok(Math.abs(scene.camera.position.y - 2.25) < 1e-9);
  assert.ok(
    scene.camera
      .getWorldDirection(new T.Vector3())
      .distanceTo(new T.Vector3(0, 0, -1)) < 1e-9,
  );
  scene.look(100, 10000);
  assert.equal(scene.pitch, -1.3);
  assert.ok(scene.local!.angle < Math.PI);
  scene.craneMode = true;
  scene.updateCamera();
  assert.equal(scene.camera, scene.overviewCamera);
  scene.craneMode = false;
  scene.updateCamera();
  assert.equal(scene.camera, scene.eyeCamera);
  scene.firstPerson = false;
  scene.updateCamera();
  assert.equal(scene.camera, scene.overviewCamera);
});

void test('roof bearing frame closes the joint at wall tops in either rotation', async () => {
  const { makePiece, disposePiece } = await import('./objects');
  const roof = makePiece('roof'),
    wall = makePiece('wall'),
    door = makePiece('door');
  const base = new T.Box3().setFromObject(roof.children[0]);
  const wallTop = new T.Box3().setFromObject(wall).max.y,
    doorTop = new T.Box3().setFromObject(door).max.y;
  assert.ok(base.min.y <= Math.min(wallTop, doorTop));
  assert.ok(base.max.y >= Math.max(wallTop, doorTop));
  for (const angle of [0, Math.PI / 2]) {
    roof.rotation.y = angle;
    const bounds = new T.Box3().setFromObject(roof.children[0]);
    assert.ok(bounds.max.x - bounds.min.x >= 1.99);
    assert.ok(bounds.max.z - bounds.min.z >= 1.99);
  }
  disposePiece(roof);
  disposePiece(wall);
  disposePiece(door);
});

void test('first-person interaction aims at the visible object and cannot grab through a wall', async () => {
  const { scene } = buildFixture(),
    { makePiece } = await import('./objects');
  Object.assign(scene, {
    firstPerson: true,
    craneMode: false,
    eyeYaw: Math.PI,
    pitch: -0.5,
    root: new T.Group(),
  });
  scene.local!.x = 0;
  scene.local!.z = 2;
  scene.local!.y = 0.43;
  const chair = {
    id: 'aim-chair',
    kind: 'chair' as const,
    x: 0,
    z: 0,
    rotation: 0,
    placed: true,
  };
  scene.snapshot!.world.pieces = [chair];
  scene.camera = new T.PerspectiveCamera(75, 1, 0.06, 100);
  scene.camera.position.set(0, 2.25, 2);
  scene.camera.lookAt(0, 1, 0);
  scene.camera.updateMatrixWorld();
  const mesh = makePiece('chair');
  mesh.position.set(0, 0.43, 0);
  mesh.userData.id = chair.id;
  mesh.updateMatrixWorld(true);
  scene.pieces.set(chair.id, mesh);
  assert.equal(scene.nearest()?.id, chair.id);
  const wall = new T.Mesh(
    new T.BoxGeometry(2, 3, 0.2),
    new T.MeshBasicMaterial(),
  );
  wall.position.set(0, 1.5, 1);
  scene.root.add(wall);
  scene.root.updateMatrixWorld(true);
  assert.equal(scene.nearest(), undefined);
});

void test('first-person WASD and joystick movement follow the camera, with correct left and right strafing', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const forward = eyeMovement(0, -1, yaw),
      right = eyeMovement(1, 0, yaw);
    const direction = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const cameraRight = new T.Vector3().crossVectors(
      direction,
      new T.Vector3(0, 1, 0),
    );
    assert.ok(
      new T.Vector3(forward.x, 0, forward.z).distanceTo(direction) < 1e-9,
    );
    assert.ok(
      new T.Vector3(right.x, 0, right.z).distanceTo(cameraRight) < 1e-9,
    );
    const backward = eyeMovement(0, 1, yaw),
      left = eyeMovement(-1, 0, yaw);
    assert.ok(
      Math.hypot(backward.x + forward.x, backward.z + forward.z) < 1e-9,
    );
    assert.ok(Math.hypot(left.x + right.x, left.z + right.z) < 1e-9);
  }
});
