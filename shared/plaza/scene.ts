import * as T from 'three';
import { createRenderer } from '../rendering/create-renderer';
import { dressedGameAvatar } from '../rendering/game-avatar';
import { poseWorker } from '../rendering/worker-pose';
import { buildStandaloneItem } from '../rendering/cosmetics/standalone-item';
import { disposeObject } from '../rendering/dispose-object';
import type { Look } from '../wardrobe/look';
import {
  boundedPose,
  nearestStation,
  PLAZA_SPEED,
  spawnPose,
  type PlazaPose,
  type PlazaStation,
} from './world';

export type PlazaPerson = {
  id: string;
  name: string;
  color: number;
  look?: Look;
  lobbyPose?: PlazaPose;
  connected?: boolean;
};
export type PlazaScene = {
  update: (players: PlazaPerson[], look: Look, paused: boolean) => void;
  direction: (x: number, z: number) => void;
  interact: () => void;
  dispose: () => void;
};

export function createPlazaScene(
  host: HTMLElement,
  self: string,
  initial: PlazaPerson[],
  onPose: (pose: PlazaPose) => void,
  onStation: (station: PlazaStation | null) => void,
  onOpen: (station: PlazaStation) => void,
): PlazaScene {
  const { renderer } = createRenderer(host, {
    shadows: 'soft',
    label:
      'Party plaza. Walk with arrow keys or WASD, or click the ground. Press E near a shop. Shop buttons are also available.',
  });
  const scene = new T.Scene();
  scene.background = new T.Color('#A8DDF0');
  const camera = new T.OrthographicCamera(-11, 11, 7, -7, 0.1, 100);
  camera.position.set(0, 20, 22);
  camera.lookAt(0, 0, -0.3);
  scene.add(new T.HemisphereLight('#fff6df', '#88aaa0', 2.6));
  const sun = new T.DirectionalLight('#fff5d6', 3);
  sun.position.set(-7, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
    near: 1,
    far: 40,
  });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);

  const mat = (color: string) =>
    new T.MeshStandardMaterial({ color, roughness: 0.94 });
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
  ) {
    const model = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
    model.position.set(x, y, z);
    model.castShadow = true;
    model.receiveShadow = true;
    scene.add(model);
    return model;
  }
  function cylinder(
    radius: number,
    height: number,
    x: number,
    y: number,
    z: number,
    color: string,
  ) {
    const mesh = new T.Mesh(
      new T.CylinderGeometry(radius, radius * 0.94, height, 24),
      mat(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  function sign(text: string, color: string, width = 3.5) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff6df';
    ctx.beginPath();
    ctx.roundRect(2, 2, 508, 92, 24);
    ctx.fill();
    ctx.font = 'bold 39px sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 25), 256, 49, 474);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(
      new T.SpriteMaterial({ map: texture, depthTest: false }),
    );
    sprite.scale.set(width, (width * 96) / 512, 1);
    return sprite;
  }

  box(21, 0.5, 15, 0, -0.35, 0, '#7faf86');
  box(18, 0.18, 11.5, 0, -0.06, 0, '#e5d6b1');
  for (let x = -8; x <= 8; x += 2)
    for (let z = -4; z <= 4; z += 2)
      box(
        1.92,
        0.035,
        1.92,
        x,
        0.05,
        z,
        (x + z) % 4 === 0 ? '#eee3c5' : '#e9ddbd',
      );
  cylinder(2.25, 0.035, 0, 0.09, 0.8, '#d69477');
  cylinder(2.05, 0.035, 0, 0.12, 0.8, '#f2c876');
  const crest = sign('JUMBLEYARD', '#287c80', 3);
  crest.position.set(0, 0.2, 0.8);
  crest.material.depthTest = true;
  scene.add(crest);

  function stall(x: number, color: string, label: string, itemId: string) {
    box(3.8, 2.45, 0.28, x, 1.25, -4.65, '#fff0cc');
    for (const dx of [-1.85, 1.85])
      cylinder(0.095, 3.3, x + dx, 1.65, -3.9, '#816c50');
    for (let i = 0; i < 8; i++) {
      const roof = box(
        0.48,
        0.15,
        2.3,
        x - 1.68 + i * 0.48,
        3.1,
        -4.1,
        i % 2 ? '#fff6df' : color,
      );
      roof.rotation.x = 0.1;
      box(
        0.48,
        0.32,
        0.12,
        x - 1.68 + i * 0.48,
        2.9,
        -2.94,
        i % 2 ? '#fff6df' : color,
      );
    }
    box(3.3, 0.8, 1.0, x, 0.55, -3.95, color);
    box(3.5, 0.13, 1.15, x, 1.0, -3.9, '#fff2d2');
    const item = buildStandaloneItem(itemId);
    item.scale.setScalar(1.1);
    item.position.set(x, 1.62, -3.85);
    scene.add(item);
    const board = sign(label, '#244943');
    board.position.set(x, 3.7, -3.7);
    scene.add(board);
    cylinder(0.36, 0.12, x - 1, 1.1, -3.8, '#efd186');
    const extra = buildStandaloneItem(
      itemId === 'frog-bucket-hat' ? 'mushroom-cap' : 'moon-glasses',
    );
    extra.scale.setScalar(0.68);
    extra.position.set(x - 1, 1.53, -3.8);
    scene.add(extra);
  }
  stall(-5.6, '#287c80', 'THE HAT STAND', 'frog-bucket-hat');
  stall(5.6, '#d96846', 'OUTFIT WORKSHOP', 'toast-puffer');
  box(2.15, 3.3, 0.25, 0, 1.65, -5.05, '#efd186');
  box(1.78, 2.9, 0.1, 0, 1.65, -4.88, '#91c8d2');
  box(0.65, 2.8, 0.06, -0.36, 1.7, -4.81, '#b7e0e3').rotation.z = -0.15;
  const fitting = sign('FITTING ROOM', '#244943', 2.8);
  fitting.position.set(0, 3.6, -4.8);
  scene.add(fitting);
  for (const x of [-9, 9])
    for (const z of [-5.7, 0, 5.7]) {
      cylinder(0.5, 0.55, x, 0.3, z, '#d69477');
      cylinder(0.08, 1.3, x, 1, z, '#8d7854');
      const leaves = new T.Mesh(
        new T.IcosahedronGeometry(0.8, 1),
        mat('#5b9675'),
      );
      leaves.position.set(x, 1.75, z);
      leaves.castShadow = true;
      scene.add(leaves);
    }
  for (const x of [-5.5, 5.5]) {
    box(2.4, 0.18, 0.65, x, 0.65, 3.6, '#b88759');
    box(2.4, 0.65, 0.13, x, 1.05, 3.88, '#b88759');
    for (const dx of [-0.9, 0.9])
      box(0.16, 0.6, 0.5, x + dx, 0.3, 3.6, '#287c80');
  }
  cylinder(1.4, 0.1, 0, 0.12, 4.2, '#287c80');
  const play = sign('LET’S PLAY', '#287c80', 2.3);
  play.position.set(0, 0.4, 4.2);
  scene.add(play);

  type Avatar = {
    root: T.Group;
    label: T.Sprite;
    signature: string;
    target: PlazaPose;
  };
  const avatars = new Map<string, Avatar>();
  let players = initial,
    look: Look = {},
    paused = false;
  let pose =
    initial.find((p) => p.id === self)?.lobbyPose ??
    spawnPose(initial.find((p) => p.id === self)?.color ?? 0);
  let target: PlazaPose | null = null,
    joystick = { x: 0, z: 0 };
  const keys = new Set<string>();
  let lastStation = '',
    frame = 0,
    previousTime = performance.now(),
    disposed = false;
  const canvas = renderer.domElement;
  const clear = () => {
    keys.clear();
    joystick = { x: 0, z: 0 };
    target = null;
  };
  const interact = () => {
    if (!paused) {
      const station = nearestStation(pose);
      if (station) onOpen(station);
    }
  };
  const down = (event: KeyboardEvent) => {
    if (document.activeElement !== canvas || paused) return;
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'w',
        'a',
        's',
        'd',
        'W',
        'A',
        'S',
        'D',
      ].includes(event.key)
    ) {
      event.preventDefault();
      keys.add(event.key.toLowerCase());
      target = null;
    }
    if (event.key.toLowerCase() === 'e' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) interact();
    }
  };
  const up = (event: KeyboardEvent) => {
    keys.delete(event.key.toLowerCase());
  };
  const ray = new T.Raycaster(),
    plane = new T.Plane(new T.Vector3(0, 1, 0), 0),
    hit = new T.Vector3();
  const pointer = (event: PointerEvent) => {
    if (paused) return;
    canvas.focus({ preventScroll: true });
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(
      new T.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    if (ray.ray.intersectPlane(plane, hit))
      target = boundedPose({ x: hit.x, z: hit.z, angle: 0 });
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  canvas.addEventListener('blur', clear);
  canvas.addEventListener('pointerdown', pointer);
  const resize = () => {
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight),
      aspect = width / height;
    const half = Math.max(6.5, 10.8 / aspect);
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const sync = () => {
    for (const [id, avatar] of avatars)
      if (!players.some((p) => p.id === id)) {
        scene.remove(avatar.root, avatar.label);
        disposeObject(avatar.root);
        disposeObject(avatar.label);
        avatars.delete(id);
      }
    for (const player of players) {
      const outfit = player.id === self ? look : (player.look ?? {});
      const signature = JSON.stringify([player.color, outfit]);
      let avatar = avatars.get(player.id);
      if (!avatar || avatar.signature !== signature) {
        const position = avatar?.root.position.clone();
        if (avatar) {
          scene.remove(avatar.root, avatar.label);
          disposeObject(avatar.root);
          disposeObject(avatar.label);
        }
        const root = dressedGameAvatar(player.color, {}, outfit).model;
        const label = sign(
          player.name + (player.id === self ? ' · You' : ''),
          '#244943',
          1.8,
        );
        const start =
          player.id === self
            ? pose
            : (player.lobbyPose ?? spawnPose(player.color));
        root.position.set(position?.x ?? start.x, 0.1, position?.z ?? start.z);
        avatar = { root, label, signature, target: start };
        avatars.set(player.id, avatar);
        scene.add(root, label);
      }
      avatar.target =
        player.id === self
          ? pose
          : (player.lobbyPose ?? spawnPose(player.color));
    }
  };
  sync();
  function tick(time: number) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (time - previousTime) / 1000);
    previousTime = time;
    if (paused || document.hidden) return;
    let dx =
      joystick.x +
      (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    let dz =
      joystick.z +
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
      (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    if (!dx && !dz && target) {
      dx = target.x - pose.x;
      dz = target.z - pose.z;
      if (Math.hypot(dx, dz) < 0.1) {
        target = null;
        dx = dz = 0;
      }
    }
    const length = Math.hypot(dx, dz);
    const moving = length > 0.01;
    if (moving) {
      const step = Math.min(PLAZA_SPEED * dt, target ? length : Infinity);
      pose = boundedPose({
        x: pose.x + (dx / length) * step,
        z: pose.z + (dz / length) * step,
        angle: Math.atan2(dx, dz),
      });
      onPose(pose);
    }
    const station = nearestStation(pose);
    if ((station?.id ?? '') !== lastStation) {
      lastStation = station?.id ?? '';
      onStation(station);
    }
    for (const [id, avatar] of avatars) {
      const goal = id === self ? pose : avatar.target;
      const walking =
        id === self
          ? moving
          : Math.hypot(
              goal.x - avatar.root.position.x,
              goal.z - avatar.root.position.z,
            ) > 0.03;
      const factor = id === self ? 1 : 1 - Math.exp(-12 * dt);
      avatar.root.position.x += (goal.x - avatar.root.position.x) * factor;
      avatar.root.position.z += (goal.z - avatar.root.position.z) * factor;
      avatar.root.rotation.y = goal.angle;
      poseWorker(avatar.root, time / 1000, walking ? 'walk' : 'still');
      avatar.label.position.set(
        avatar.root.position.x,
        2.3,
        avatar.root.position.z,
      );
    }
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(tick);
  return {
    update(next, outfit, stop) {
      players = next;
      look = outfit;
      if (stop && !paused) clear();
      paused = stop;
      sync();
    },
    direction(x, z) {
      joystick = { x, z };
      target = null;
    },
    interact,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      canvas.removeEventListener('blur', clear);
      canvas.removeEventListener('pointerdown', pointer);
      disposeObject(scene);
      sun.shadow.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
