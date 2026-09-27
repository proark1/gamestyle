import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { liveKid } from '../../shared/rendering/avatars/kid';
import { poseWorker } from '../../shared/rendering/worker-pose';
import { FISH_DEFINITIONS } from './content/fish';
import { ITEM_DEFINITIONS } from './content/items';
import { STATION_POSITIONS } from './stations';
import type {
  AdventureSnapshot,
  AdventureWorld,
  ItemStateRecord,
  StreamCell,
} from './types';
import {
  DOCK_HEIGHT,
  HARBOR_LAYOUT,
  NICO_EYE_HEIGHT,
  SHORE_HEIGHT,
  localSurfaceHeight,
} from './world-layout';

const clay = (
  color: THREE.ColorRepresentation,
  roughness = 0.78,
  metalness = 0.02,
) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const wood = clay(0x7d432a, 0.9);
const darkWood = clay(0x3e241c, 0.92);
const cream = clay(0xf4d9a6, 0.88);
const brass = clay(0xc7832d, 0.34, 0.62);
const red = clay(0xd64d3d, 0.75);
const teal = clay(0x2f817d, 0.75);
const navy = clay(0x20364a, 0.8);
const rubber = clay(0x18222a, 0.94);

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const radius = Math.max(0.008, Math.min(0.075, w * 0.16, h * 0.16, d * 0.16));
  return mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material, x, y, z);
}

function cylinder(
  rt: number,
  rb: number,
  h: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  segments = 16,
) {
  return mesh(
    new THREE.CylinderGeometry(rt, rb, h, segments, 2),
    material,
    x,
    y,
    z,
  );
}

function markInteractive(root: THREE.Object3D, target: string) {
  root.traverse((child) => {
    child.userData.target = target;
  });
}

function makeFish(color: THREE.ColorRepresentation = 0x60a8b3) {
  const group = new THREE.Group();
  const fishMaterial = clay(color, 0.52);
  const body = mesh(
    new THREE.SphereGeometry(0.48, 18, 12),
    fishMaterial,
    0,
    0.35,
    0,
  );
  body.scale.set(0.72, 0.52, 1.22);
  const tail = mesh(new THREE.ConeGeometry(0.34, 0.58, 3), fishMaterial, 0, 0.35, -0.75);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.x = 0.65;
  const dorsal = mesh(new THREE.ConeGeometry(0.2, 0.46, 3), fishMaterial, 0, 0.72, -0.08);
  dorsal.rotation.x = Math.PI / 2;
  dorsal.scale.x = 0.42;
  const mouth = mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 12), clay(0x5c2730), 0, 0.31, 0.57);
  for (const side of [-1, 1]) {
    const eye = mesh(
      new THREE.SphereGeometry(0.048, 9, 7),
      rubber,
      side * 0.25,
      0.47,
      0.38,
    );
    const glint = mesh(
      new THREE.SphereGeometry(0.015, 6, 5),
      cream,
      side * 0.274,
      0.485,
      0.412,
    );
    const fin = mesh(new THREE.ConeGeometry(0.12, 0.34, 3), fishMaterial, side * 0.29, 0.28, 0.02);
    fin.rotation.z = side * -1.05;
    fin.rotation.x = 0.3;
    group.add(eye, glint, fin);
  }
  group.add(body, tail, dorsal, mouth);
  return group;
}

function makeItemModel(item: Pick<ItemStateRecord, 'kind' | 'fishSpecies'>) {
  const group = new THREE.Group();
  if (item.kind === 'rope') {
    for (let i = 0; i < 3; i++) {
      const loop = mesh(
        new THREE.TorusGeometry(0.34 - i * 0.025, 0.055, 7, 18),
        clay(0xb98d58),
        0,
        0.17 + i * 0.08,
        0,
      );
      loop.rotation.x = Math.PI / 2;
      group.add(loop);
    }
  } else if (item.kind === 'rod') {
    const rod = cylinder(0.022, 0.045, 1.55, clay(0x3e241c), 0, 0.8, 0);
    rod.rotation.z = -0.2;
    const reel = mesh(
      new THREE.TorusGeometry(0.13, 0.035, 7, 13),
      brass,
      -0.14,
      0.48,
      0,
    );
    reel.rotation.y = Math.PI / 2;
    group.add(rod, reel);
    for (let i = 0; i < 4; i++) {
      const guide = mesh(
        new THREE.TorusGeometry(0.045, 0.009, 5, 10),
        brass,
        -0.08 - i * 0.06,
        0.82 + i * 0.27,
        0,
      );
      guide.rotation.y = Math.PI / 2;
      group.add(guide);
    }
  } else if (item.kind === 'bait-bucket') {
    const bucket = cylinder(0.34, 0.27, 0.48, clay(0x6595a0), 0, 0.28, 0);
    const rim = mesh(
      new THREE.TorusGeometry(0.35, 0.035, 6, 16),
      brass,
      0,
      0.53,
      0,
    );
    rim.rotation.x = Math.PI / 2;
    const bait = cylinder(0.27, 0.27, 0.025, clay(0x704a35), 0, 0.55, 0);
    group.add(bucket, rim, bait);
  } else if (item.kind === 'lantern') {
    group.add(
      box(0.3, 0.1, 0.3, brass, 0, 0.12),
      box(
        0.24,
        0.36,
        0.24,
        new THREE.MeshStandardMaterial({
          color: 0xffce6a,
          emissive: 0xff8a22,
          emissiveIntensity: 2,
          transparent: true,
          opacity: 0.82,
        }),
        0,
        0.34,
      ),
      cylinder(0.12, 0.18, 0.12, brass, 0, 0.58),
    );
  } else if (item.kind === 'timber') {
    for (let i = 0; i < 3; i++)
      group.add(
        box(
          0.92,
          0.11,
          0.18,
          clay(0xb46e3c),
          0,
          0.12 + i * 0.12,
          (i - 1) * 0.19,
        ),
      );
  } else if (item.kind === 'hammer') {
    const handle = cylinder(0.035, 0.05, 0.62, wood, 0, 0.32);
    handle.rotation.z = -0.25;
    group.add(
      handle,
      box(0.38, 0.16, 0.16, clay(0x3f5057, 0.42, 0.48), -0.08, 0.64),
    );
  } else if (item.kind === 'bailer') {
    group.add(
      mesh(
        new THREE.SphereGeometry(0.28, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
        clay(0xd7a45f),
        0,
        0.2,
      ),
      cylinder(0.035, 0.045, 0.48, wood, 0.3, 0.28),
    );
  } else if (item.kind === 'fuel-can') {
    group.add(
      box(0.48, 0.62, 0.28, red, 0, 0.34),
      cylinder(0.08, 0.08, 0.14, rubber, 0.13, 0.71),
    );
    const handle = mesh(
      new THREE.TorusGeometry(0.16, 0.035, 7, 12, Math.PI),
      red,
      0,
      0.66,
    );
    group.add(handle);
  } else if (item.kind === 'ice-box') {
    group.add(
      box(0.82, 0.48, 0.58, cream, 0, 0.27),
      box(0.86, 0.12, 0.62, teal, 0, 0.57),
      box(0.15, 0.05, 0.05, rubber, 0, 0.45, 0.31),
    );
  } else if (item.kind === 'landing-net') {
    const pole = cylinder(0.025, 0.04, 1.15, wood, 0, 0.58);
    pole.rotation.z = 0.35;
    const ring = mesh(
      new THREE.TorusGeometry(0.34, 0.035, 7, 16),
      brass,
      -0.21,
      1.12,
    );
    ring.rotation.y = Math.PI / 2;
    const net = mesh(
      new THREE.ConeGeometry(0.31, 0.52, 12, 3, true),
      new THREE.MeshStandardMaterial({
        color: 0xd7c79d,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      }),
      -0.21,
      0.88,
      0,
    );
    net.rotation.z = Math.PI / 2;
    group.add(pole, ring, net);
  } else if (item.kind === 'chart') {
    group.add(
      box(0.58, 0.035, 0.42, clay(0xe2c88d), 0, 0.08),
      cylinder(0.055, 0.055, 0.5, wood, -0.3, 0.1),
      cylinder(0.055, 0.055, 0.5, wood, 0.3, 0.1),
    );
  } else if (item.kind === 'compass') {
    const base = cylinder(0.22, 0.22, 0.09, brass, 0, 0.09);
    const face = cylinder(0.17, 0.17, 0.02, cream, 0, 0.15);
    group.add(base, face);
  } else if (item.kind === 'fish') {
    group.add(
      makeFish(
        item.fishSpecies ? FISH_DEFINITIONS[item.fishSpecies].color : 0x60a8b3,
      ),
    );
  }
  group.name = ITEM_DEFINITIONS[item.kind].model;
  return group;
}

function makeBell(target?: string) {
  const group = new THREE.Group();
  const frame = clay(0x5c3423);
  group.add(
    box(0.24, 3.1, 0.24, frame, -0.95, 1.55),
    box(0.24, 3.1, 0.24, frame, 0.95, 1.55),
    box(2.15, 0.25, 0.3, frame, 0, 3.02),
  );
  const profile = [
    new THREE.Vector2(0.08, 0),
    new THREE.Vector2(0.17, 0.25),
    new THREE.Vector2(0.33, 0.72),
    new THREE.Vector2(0.55, 0.86),
    new THREE.Vector2(0.62, 0.95),
  ];
  const bell = mesh(new THREE.LatheGeometry(profile, 24), brass, 0, 2.22);
  bell.rotation.x = Math.PI;
  const clapper = cylinder(0.08, 0.08, 0.48, darkWood, 0, 1.8);
  group.add(bell, clapper);
  if (target) markInteractive(group, target);
  return group;
}

function makeBoat() {
  const boat = new THREE.Group();
  const hullMaterial = clay(0xd2503c, 0.68);
  const hull = mesh(
    new THREE.CapsuleGeometry(2.45, 4.5, 8, 18),
    hullMaterial,
    0,
    0.45,
    0,
  );
  hull.scale.set(1, 0.33, 1.15);
  hull.rotation.x = Math.PI / 2;
  boat.add(hull);
  boat.add(box(5.3, 0.18, 6.9, clay(0xc8884a), 0, 0.86, 0));
  const inner = box(4.55, 0.12, 6.15, clay(0xdeb06c), 0, 0.98, 0);
  boat.add(inner);
  for (const side of [-1, 1]) {
    boat.add(box(0.19, 0.7, 7.15, cream, side * 2.72, 1.18, 0));
    const topRail = cylinder(
      0.065,
      0.065,
      7.12,
      brass,
      side * 2.72,
      2.03,
      0,
    );
    topRail.rotation.x = Math.PI / 2;
    boat.add(topRail);
    for (let z = -2.8; z <= 2.8; z += 1.4)
      boat.add(cylinder(0.07, 0.07, 0.74, brass, side * 2.72, 1.68, z));
    for (const z of [-2.25, 0.35, 2.55]) {
      const fender = mesh(
        new THREE.CapsuleGeometry(0.15, 0.52, 5, 10),
        rubber,
        side * 2.92,
        1.02,
        z,
      );
      fender.rotation.z = side * 0.08;
      boat.add(fender);
    }
  }
  boat.add(
    box(5.55, 0.18, 0.24, cream, 0, 1.18, -3.55),
    box(5.55, 0.18, 0.24, cream, 0, 1.18, 3.55),
  );
  const wheel = mesh(
    new THREE.TorusGeometry(0.55, 0.075, 8, 18),
    darkWood,
    0,
    1.85,
    -2.5,
  );
  for (let i = 0; i < 8; i++) {
    const spoke = box(0.065, 1.25, 0.065, darkWood);
    spoke.rotation.z = (i * Math.PI) / 4;
    wheel.add(spoke);
  }
  boat.add(
    wheel,
    box(1.8, 0.75, 0.75, navy, 0, 1.25, -3.02),
    box(2.5, 0.68, 0.82, clay(0x37606b), 0.2, 1.28, 3.05),
  );
  const cabin = new THREE.Group();
  cabin.position.set(0, 1.0, -2.75);
  cabin.add(
    box(2.55, 1.45, 0.14, cream, 0, 0.76, -0.65),
    box(0.14, 1.45, 1.42, cream, -1.2, 0.76, 0),
    box(0.14, 1.45, 1.42, cream, 1.2, 0.76, 0),
    box(2.82, 0.18, 1.68, red, 0, 1.55, 0),
    box(0.82, 0.58, 0.06, clay(0x80b8bd, 0.25, 0.04), -0.58, 0.94, -0.74),
    box(0.82, 0.58, 0.06, clay(0x80b8bd, 0.25, 0.04), 0.58, 0.94, -0.74),
  );
  for (const side of [-1, 1])
    cabin.add(
      box(
        0.06,
        0.54,
        0.7,
        clay(0x80b8bd, 0.25, 0.04),
        side * 1.29,
        0.94,
        0,
      ),
    );
  boat.add(cabin);

  const mast = cylinder(0.08, 0.12, 4.5, darkWood, 2.18, 3.25, 0.15);
  const boom = cylinder(0.055, 0.055, 2.8, brass, 2.18, 4.68, 0.15);
  boom.rotation.z = Math.PI / 2;
  boat.add(mast, boom);
  const ropeMaterial = new THREE.LineBasicMaterial({ color: 0xd6bb8a });
  for (const end of [
    new THREE.Vector3(-2.55, 1.95, -3.35),
    new THREE.Vector3(2.55, 1.95, -3.35),
    new THREE.Vector3(-2.55, 1.95, 2.8),
  ])
    boat.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(2.18, 5.45, 0.15),
          end,
        ]),
        ropeMaterial,
      ),
    );

  const liveWell = box(1.45, 0.64, 1.0, teal, 1.35, 1.34, 1.2);
  const liveWellLid = box(1.5, 0.1, 1.05, cream, 1.35, 1.71, 1.2);
  liveWellLid.rotation.x = -0.08;
  boat.add(liveWell, liveWellLid);
  for (const [kind, point] of Object.entries(STATION_POSITIONS)) {
    const marker = mesh(
      new THREE.CylinderGeometry(0.19, 0.21, 0.055, 10),
      new THREE.MeshStandardMaterial({
        color: 0xd69a42,
        emissive: 0xe66a22,
        emissiveIntensity: 0.42,
        roughness: 0.5,
        metalness: 0.38,
      }),
      point.x,
      1.1,
      point.z,
    );
    marker.userData.target = `station:${kind}`;
    boat.add(marker);
  }
  return boat;
}

function makeOcean() {
  const uniforms = {
    time: { value: 0 },
    boat: { value: new THREE.Vector2() },
    fog: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float time; varying float wave; varying vec3 worldPos;
      void main() {
        vec3 p = position;
        float a = sin((p.x + time * 2.2) * .12) * .38;
        float b = sin((p.y - time * 1.7) * .19 + p.x * .05) * .22;
        float c = sin((p.x + p.y) * .34 + time * 1.3) * .08;
        p.z += a + b + c;
        wave = a + b + c;
        vec4 w = modelMatrix * vec4(p, 1.);
        worldPos = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying float wave; varying vec3 worldPos; uniform float time; uniform float fog;
      void main() {
        vec3 dx = dFdx(worldPos);
        vec3 dy = dFdy(worldPos);
        vec3 normal = normalize(cross(dx, dy));
        if (normal.y < 0.) normal *= -1.;
        vec3 viewDir = normalize(cameraPosition - worldPos);
        vec3 sunDir = normalize(vec3(-.45, .82, -.36));
        float fresnel = pow(1. - max(dot(normal, viewDir), 0.), 3.);
        float sparkle = pow(max(dot(reflect(-sunDir, normal), viewDir), 0.), 44.);
        float ripples = sin(worldPos.x * .38 + worldPos.z * .24 + time * 1.15);
        float crest = smoothstep(.40, .72, wave + ripples * .13);
        float brokenFoam = smoothstep(.2, .92, sin(worldPos.x * .31 - worldPos.z * .27 + time * .7));
        float foam = crest * brokenFoam;
        vec3 deep = vec3(.018, .135, .20);
        vec3 high = vec3(.055, .37, .40);
        vec3 horizon = vec3(.30, .58, .58);
        vec3 color = mix(deep, high, clamp(wave + .48, 0., 1.));
        color = mix(color, horizon, fresnel * .52);
        color += vec3(1., .78, .48) * sparkle * .72;
        color = mix(color, vec3(.78, .91, .84), foam * .38);
        color = mix(color, vec3(.65, .68, .64), fog * .35);
        gl_FragColor = vec4(color, .985);
      }`,
    side: THREE.DoubleSide,
  });
  const ocean = mesh(
    new THREE.PlaneGeometry(420, 420, 96, 96),
    material,
    0,
    0,
    0,
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.receiveShadow = true;
  return { ocean, material };
}

function makeCrew(color: number) {
  const shirts = ['#ef7057', '#f6b94d', '#47a8a0', '#7d85c9'];
  const { model } = dressedGameAvatar(color, {
    shirt: shirts[color % shirts.length],
    overalls: '#274f5a',
    boots: '#563f30',
    trousers: true,
  });
  model.name = 'nico-fishing-crew';
  return model;
}

function makeCell(cell: StreamCell) {
  const group = new THREE.Group();
  group.position.set((cell.x + 0.5) * 48, 0, (cell.z + 0.5) * 48);
  if (cell.kind === 'rocks') {
    for (let i = 0; i < 4; i++) {
      const rock = mesh(
        new THREE.DodecahedronGeometry(1.7 + ((cell.seed >> i) & 3) * 0.45, 0),
        clay(0x596b67),
        (i - 1.5) * 2.4,
        0.8,
        ((cell.seed >> (i + 3)) & 5) - 2.5,
      );
      rock.scale.y = 1.4;
      group.add(rock);
    }
  } else if (cell.kind === 'islet') {
    const land = cylinder(4.2, 5.3, 1.2, clay(0xb99a61), 0, 0.3, 0, 12);
    group.add(land);
    for (let i = 0; i < 5; i++) {
      const trunk = cylinder(
        0.2,
        0.28,
        2.2,
        wood,
        (i - 2) * 1.15,
        1.5,
        (i % 2) * 1.2,
      );
      const crown = mesh(
        new THREE.ConeGeometry(1.05, 2.3, 8),
        clay(0x3f7761),
        trunk.position.x,
        3,
        trunk.position.z,
      );
      group.add(trunk, crown);
    }
  }
  return group;
}

export class ReelProblems3Scene {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(71, 1, 0.06, 520);
  private renderer: THREE.WebGLRenderer;
  private ocean: THREE.Mesh;
  private oceanMaterial: THREE.ShaderMaterial;
  private boat = makeBoat();
  private itemMeshes = new Map<string, THREE.Group>();
  private crewMeshes = new Map<string, THREE.Group>();
  private fishMeshes = new Map<string, THREE.Group>();
  private lineMeshes = new Map<string, THREE.Line>();
  private cellMeshes = new Map<string, THREE.Group>();
  private latest?: AdventureSnapshot;
  private localId = 'local';
  private selected: string | null = null;
  private yaw = -Math.PI * 0.25;
  private pitch = -0.08;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(0, 0);
  private resize: ResizeObserver;
  private frame = 0;
  private viewModel = new THREE.Group();
  private firstPersonAvatar?: THREE.Group;
  private heldView?: THREE.Group;
  private heldId = '';
  private cameraPoint = new THREE.Vector3();
  private boatQuaternion = new THREE.Quaternion();
  private lookQuaternion = new THREE.Quaternion();
  private lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(
    private host: HTMLElement,
    private onTarget: (target: string | null) => void,
  ) {
    this.scene.background = new THREE.Color(0x9dd0c5);
    this.scene.fog = new THREE.FogExp2(0x9cc8bd, 0.0065);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.append(this.renderer.domElement);
    const ocean = makeOcean();
    this.ocean = ocean.ocean;
    this.oceanMaterial = ocean.material;
    this.scene.add(this.ocean, this.boat);
    this.addHarbor();
    this.addLights();
    this.addViewModel();
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    this.renderer.domElement.addEventListener('click', this.lock);
    document.addEventListener('mousemove', this.mouse);
    this.frame = requestAnimationFrame(this.animate);
  }

  private addLights() {
    this.scene.add(new THREE.HemisphereLight(0xd7fff1, 0x173746, 2.8));
    const sun = new THREE.DirectionalLight(0xffe4b0, 5.2);
    sun.position.set(-25, 42, -18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    this.scene.add(sun);
  }

  private addHarbor() {
    const dock = new THREE.Group();
    for (let z = -5; z < 6; z++)
      dock.add(box(5.8, 0.25, 0.84, wood, 7.2, 0.82, z * 0.86));
    for (const z of [-4.2, 0, 4.2])
      for (const x of [4.6, 9.8])
        dock.add(cylinder(0.18, 0.25, 3, darkWood, x, -0.05, z));
    const gangway = box(1.8, 0.18, 2.2, clay(0xc18a50), 3.65, 1.02, 0);
    gangway.rotation.z = -0.06;
    dock.add(gangway);
    const bell = makeBell('depart');
    bell.position.set(
      HARBOR_LAYOUT.bell.x,
      DOCK_HEIGHT,
      HARBOR_LAYOUT.bell.z,
    );
    dock.add(bell);
    const shore = box(14, 1.4, 24, clay(0x8eaa79), 16.2, 0.15, 0);
    dock.add(shore);
    const tower = new THREE.Group();
    tower.position.set(
      HARBOR_LAYOUT.tower.x,
      SHORE_HEIGHT,
      HARBOR_LAYOUT.tower.z,
    );
    tower.add(
      cylinder(1.72, 2.08, 6.4, clay(0xd6b47a), 0, 3.2, 0, 16),
      cylinder(1.83, 1.83, 0.24, cream, 0, 1.45, 0, 16),
      cylinder(1.65, 1.72, 0.24, red, 0, 4.85, 0, 16),
      mesh(new THREE.ConeGeometry(2.12, 2.0, 16), red, 0, 7.25),
    );
    for (const side of [-1, 1]) {
      const window = box(0.42, 1.18, 0.12, navy, side * 0.62, 4.1, -1.63);
      window.rotation.z = side * 0.03;
      tower.add(window);
    }
    const lanternRoom = cylinder(1.35, 1.35, 1.12, brass, 0, 5.75, 0, 12);
    const lanternGlow = cylinder(
      1.08,
      1.08,
      0.74,
      new THREE.MeshStandardMaterial({
        color: 0xffe7a1,
        emissive: 0xffb54a,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.72,
      }),
      0,
      5.77,
      0,
      12,
    );
    tower.add(lanternRoom, lanternGlow);
    dock.add(tower);

    const shed = new THREE.Group();
    shed.position.set(
      HARBOR_LAYOUT.shed.x,
      SHORE_HEIGHT,
      HARBOR_LAYOUT.shed.z,
    );
    shed.add(
      box(HARBOR_LAYOUT.shed.width, 1.75, HARBOR_LAYOUT.shed.depth, red, 0, 0.88),
      box(0.82, 1.35, 0.12, darkWood, 0.45, 0.68, -0.9),
      box(0.58, 0.58, 0.12, cream, -0.55, 1.05, -0.9),
    );
    const shedRoof = mesh(
      new THREE.ConeGeometry(1.85, 1.1, 4),
      navy,
      0,
      2.15,
      0,
    );
    shedRoof.rotation.y = Math.PI / 4;
    shedRoof.scale.z = 0.72;
    shed.add(shedRoof);
    dock.add(shed);

    for (const tree of HARBOR_LAYOUT.trees) {
      const trunk = cylinder(0.2, 0.27, 2.25, wood, tree.x, 1.8, tree.z);
      const crown = mesh(
        new THREE.IcosahedronGeometry(1.05, 1),
        clay(0x4f7d5f),
        tree.x,
        3.3,
        tree.z,
      );
      crown.scale.set(1, 1.25, 1);
      dock.add(trunk, crown);
    }
    for (const rock of HARBOR_LAYOUT.rocks) {
      const stone = mesh(
        new THREE.DodecahedronGeometry(rock.radius, 0),
        clay(0x68756d),
        rock.x,
        SHORE_HEIGHT + rock.radius * 0.55,
        rock.z,
      );
      stone.scale.set(1.25, 0.75, 1);
      dock.add(stone);
    }
    this.scene.add(dock);
  }

  private addViewModel() {
    const { model } = dressedGameAvatar(0, {
      shirt: '#ef7057',
      overalls: '#274f5a',
      boots: '#563f30',
      trousers: true,
    });
    const sleeveL = model.userData.sleeveL as THREE.Object3D;
    const sleeveR = model.userData.sleeveR as THREE.Object3D;
    const visible = new Set<THREE.Object3D>();
    sleeveL.traverse((part) => visible.add(part));
    sleeveR.traverse((part) => visible.add(part));
    model.traverse((part) => {
      if (part instanceof THREE.Mesh) part.visible = visible.has(part);
    });
    model.position.set(0, -1.38, -1.05);
    model.rotation.y = Math.PI;
    model.scale.setScalar(0.72);
    const armL = model.userData.armL as THREE.Group;
    const armR = model.userData.armR as THREE.Group;
    armL.rotation.set(-0.28, -0.08, 0.22);
    armR.rotation.set(-0.28, 0.08, -0.22);
    this.firstPersonAvatar = model;
    this.viewModel.add(model);
    this.camera.add(this.viewModel);
    this.scene.add(this.camera);
  }

  setLocalPlayer(id: string) {
    this.localId = id;
  }
  setReducedMotion(_reduced: boolean) {}
  getYaw() {
    return this.yaw;
  }
  look(dx: number, dy: number) {
    this.yaw -= dx * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0018, -1.12, 1.05);
  }
  target() {
    return this.selected;
  }

  private lock = () => {
    if (!document.pointerLockElement)
      void this.renderer.domElement.requestPointerLock?.();
  };
  private mouse = (event: MouseEvent) => {
    if (document.pointerLockElement === this.renderer.domElement)
      this.look(event.movementX, event.movementY);
  };

  render(snapshot: AdventureSnapshot) {
    this.latest = snapshot;
    const { world } = snapshot;
    this.boat.position.set(world.boat.x, 0.12, world.boat.z);
    this.boat.rotation.set(world.boat.pitch, world.boat.yaw, -world.boat.roll);
    this.syncItems(world);
    this.syncCrew(world);
    this.syncFish(world);
    this.syncLines(world);
    this.syncCells(world.cells);
    this.oceanMaterial.uniforms.fog.value =
      world.fogUntil > world.clock ? 1 : 0;
    if (this.scene.fog)
      (this.scene.fog as THREE.FogExp2).density =
        world.fogUntil > world.clock ? 0.025 : 0.0065;
  }

  private syncItems(world: AdventureWorld) {
    const alive = new Set<string>();
    for (const item of world.items) {
      if (['held', 'submerged'].includes(item.state)) continue;
      alive.add(item.id);
      let model = this.itemMeshes.get(item.id);
      if (!model) {
        model = makeItemModel(item);
        markInteractive(model, item.id);
        this.itemMeshes.set(item.id, model);
      }
      const parent = item.space === 'boat' ? this.boat : this.scene;
      if (model.parent !== parent) parent.add(model);
      model.position.set(
        item.x,
        item.space === 'boat'
          ? 1.02 + item.y
          : item.state === 'floating'
            ? 0.25
            : item.y,
        item.z,
      );
      model.rotation.y = item.yaw;
      model.scale.setScalar(item.state === 'secured' ? 0.75 : 1);
    }
    for (const [id, model] of this.itemMeshes)
      if (!alive.has(id)) {
        model.removeFromParent();
        this.itemMeshes.delete(id);
      }
    const heldId =
      world.players.find((player) => player.id === this.localId)?.held[0] ?? '';
    if (heldId !== this.heldId) {
      this.heldView?.removeFromParent();
      this.heldView = undefined;
      this.heldId = heldId;
      const held = world.items.find((item) => item.id === heldId);
      if (held) {
        this.heldView = makeItemModel(held);
        this.heldView.position.set(0.28, -0.48, -0.95);
        this.heldView.rotation.set(-0.3, 0.2, -0.08);
        this.heldView.scale.setScalar(0.48);
        this.viewModel.add(this.heldView);
      }
    }
  }

  private syncCrew(world: AdventureWorld) {
    const alive = new Set<string>();
    const local = world.players.find((player) => player.id === this.localId);
    for (const player of world.players) {
      if (player.id === this.localId) continue;
      alive.add(player.id);
      let model = this.crewMeshes.get(player.id);
      if (!model) {
        model = makeCrew(player.color);
        this.crewMeshes.set(player.id, model);
      }
      const parent = player.space === 'boat' ? this.boat : this.scene;
      if (model.parent !== parent) parent.add(model);
      model.position.set(
        player.x,
        player.space === 'boat'
          ? localSurfaceHeight(world.phase, player.x, player.z)
          : -0.35,
        player.z,
      );
      model.rotation.y = player.yaw;
      model.visible =
        !local ||
        local.space !== player.space ||
        Math.hypot(local.x - player.x, local.z - player.z) > 1.8;
      const moving = Math.abs(player.input.x) + Math.abs(player.input.z) > 0.08;
      poseWorker(model, world.clock / 1000, moving ? 'walk' : 'still');
      liveKid(model, world.clock / 1000, moving);
      const armL = model.userData.armL as THREE.Group | undefined;
      const armR = model.userData.armR as THREE.Group | undefined;
      if (player.line && armL && armR) {
        armL.rotation.x = -1.12;
        armR.rotation.x = -1.28;
      } else if (player.held.length > 0 && armL && armR) {
        armL.rotation.x = -0.82;
        armR.rotation.x = -0.82;
      }
    }
    for (const [id, model] of this.crewMeshes)
      if (!alive.has(id)) {
        model.removeFromParent();
        this.crewMeshes.delete(id);
      }
  }

  private syncFish(world: AdventureWorld) {
    const alive = new Set<string>();
    for (const fish of world.fish) {
      if (!['swimming', 'hooked'].includes(fish.state)) continue;
      alive.add(fish.id);
      let model = this.fishMeshes.get(fish.id);
      if (!model) {
        model = makeFish(FISH_DEFINITIONS[fish.species].color);
        this.fishMeshes.set(fish.id, model);
        this.scene.add(model);
      }
      model.position.set(
        fish.x,
        -0.65 + Math.sin(world.clock / 350 + fish.weight) * 0.2,
        fish.z,
      );
      model.rotation.y = Math.atan2(fish.vx, fish.vz);
      model.scale.setScalar(0.75 + fish.weight * 0.035);
    }
    for (const [id, model] of this.fishMeshes)
      if (!alive.has(id)) {
        model.removeFromParent();
        this.fishMeshes.delete(id);
      }
  }

  private syncLines(world: AdventureWorld) {
    const alive = new Set<string>();
    for (const player of world.players) {
      if (!player.line) continue;
      alive.add(player.id);
      let line = this.lineMeshes.get(player.id);
      if (!line) {
        line = new THREE.Line(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({
            color: 0xf7ddb2,
            transparent: true,
            opacity: 0.9,
          }),
        );
        this.lineMeshes.set(player.id, line);
        this.scene.add(line);
      }
      const cosine = Math.cos(world.boat.yaw);
      const sine = Math.sin(world.boat.yaw);
      const startX =
        player.space === 'boat'
          ? world.boat.x + player.x * cosine + player.z * sine
          : player.x;
      const startZ =
        player.space === 'boat'
          ? world.boat.z - player.x * sine + player.z * cosine
          : player.z;
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(startX, 1.75, startZ),
        new THREE.Vector3(
          player.line.x,
          player.line.state === 'hooked' ? -0.25 : 0.08,
          player.line.z,
        ),
      ]);
      (line.material as THREE.LineBasicMaterial).color.set(
        player.line.tension > 0.88
          ? 0xff5f45
          : player.line.state === 'biting'
            ? 0xffcb52
            : 0xf7ddb2,
      );
    }
    for (const [id, line] of this.lineMeshes)
      if (!alive.has(id)) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
        line.removeFromParent();
        this.lineMeshes.delete(id);
      }
  }

  private syncCells(cells: StreamCell[]) {
    const alive = new Set(cells.map((cell) => cell.id));
    for (const cell of cells)
      if (!this.cellMeshes.has(cell.id)) {
        const model = makeCell(cell);
        this.cellMeshes.set(cell.id, model);
        this.scene.add(model);
      }
    for (const [id, model] of this.cellMeshes)
      if (!alive.has(id)) {
        model.removeFromParent();
        this.cellMeshes.delete(id);
      }
  }

  private updateCamera(world: AdventureWorld) {
    this.viewModel.visible = !['lobby', 'finished', 'failed'].includes(
      world.phase,
    );
    const player = world.players.find(
      (candidate) => candidate.id === this.localId,
    );
    if (!player) {
      this.camera.position.set(11, 8, 13);
      this.camera.lookAt(0, 1, 0);
      return;
    }
    if (player.space === 'boat') {
      this.boat.updateWorldMatrix(true, false);
      this.cameraPoint.set(
        player.x,
        localSurfaceHeight(world.phase, player.x, player.z) + NICO_EYE_HEIGHT,
        player.z,
      );
      this.boat.localToWorld(this.cameraPoint);
      this.camera.position.copy(this.cameraPoint);
      this.boat.getWorldQuaternion(this.boatQuaternion);
      this.lookEuler.set(this.pitch, this.yaw, 0, 'YXZ');
      this.lookQuaternion.setFromEuler(this.lookEuler);
      this.camera.quaternion
        .copy(this.boatQuaternion)
        .multiply(this.lookQuaternion);
    } else {
      this.camera.position.set(player.x, 0.78, player.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }
    const walking = Math.abs(player.input.x) + Math.abs(player.input.z);
    this.camera.position.y +=
      walking > 0.05 ? Math.sin(performance.now() / 105) * 0.025 : 0;
    if (this.firstPersonAvatar) {
      const armL = this.firstPersonAvatar.userData.armL as THREE.Group;
      const armR = this.firstPersonAvatar.userData.armR as THREE.Group;
      const sway =
        walking > 0.05 ? Math.sin(performance.now() / 130) * 0.045 : 0;
      armL.rotation.x = -0.28 + sway;
      armR.rotation.x = -0.28 - sway;
    }
  }

  private pickTarget() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    let next: string | null = null;
    for (const hit of hits) {
      const target = hit.object.userData.target as string | undefined;
      if (!target) continue;
      if (hit.distance <= 3.2 || target === 'depart') {
        next = target;
        break;
      }
    }
    if (next !== this.selected) {
      this.selected = next;
      this.onTarget(next);
    }
  }

  private animate = () => {
    this.frame = requestAnimationFrame(this.animate);
    const elapsed = performance.now() / 1000;
    this.oceanMaterial.uniforms.time.value = elapsed;
    if (this.latest) {
      this.updateCamera(this.latest.world);
      this.pickTarget();
      const roll = this.latest.world.boat.roll;
      this.viewModel.rotation.z +=
        (-roll * 0.8 - this.viewModel.rotation.z) * 0.08;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private fit() {
    const width = Math.max(1, this.host.clientWidth),
      height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.renderer.domElement.removeEventListener('click', this.lock);
    document.removeEventListener('mousemove', this.mouse);
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
