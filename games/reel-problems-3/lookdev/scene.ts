import * as T from 'three';
import { createRenderer } from '../../../shared/rendering/create-renderer';
import { disposeObject } from '../../../shared/rendering/dispose-object';
import {
  applyComicTreatment,
  COMIC_TREATMENTS,
  installComicTreatment,
} from './comic';
import { lookPose, movePose, START_POSE, summarizeFrames } from './controller';
import { LOOK_STYLES } from './styles';
import { createSculptedWater, type SculptedWater } from './water';
import type {
  LookdevInput,
  LookdevRuntime,
  LookdevStats,
  LookStyleId,
  MaterialRole,
  PlayerPose,
} from './types';

type TaggedMesh = T.Mesh<T.BufferGeometry, T.MeshStandardMaterial> & {
  userData: {
    role?: MaterialRole;
    outline?: T.LineSegments;
    sketchOutline?: T.LineSegments;
  };
};

const ZERO_INPUT: LookdevInput = { forward: 0, strafe: 0, sprint: false };

function seeded(index: number) {
  const value = Math.sin(index * 91.733 + 17.131) * 43758.5453;
  return value - Math.floor(value);
}

function clayTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#929292';
  context.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 430; i++) {
    const x = seeded(i * 4) * 128;
    const y = seeded(i * 4 + 1) * 128;
    const radius = 0.35 + seeded(i * 4 + 2) * 1.8;
    const light = 116 + Math.round(seeded(i * 4 + 3) * 45);
    context.fillStyle = `rgba(${light},${light},${light},${0.08 + seeded(i + 8) * 0.17})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = 'rgba(70,70,70,.09)';
  context.lineWidth = 0.7;
  for (let i = 0; i < 18; i++) {
    const y = 5 + i * 7 + seeded(i) * 3;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(34, y + 4, 88, y - 5, 128, y + 2);
    context.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(2.8, 2.8);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

function roundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.12,
) {
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new T.Shape();
  shape.moveTo(r, 0);
  shape.lineTo(width - r, 0);
  shape.quadraticCurveTo(width, 0, width, r);
  shape.lineTo(width, height - r);
  shape.quadraticCurveTo(width, height, width - r, height);
  shape.lineTo(r, height);
  shape.quadraticCurveTo(0, height, 0, height - r);
  shape.lineTo(0, r);
  shape.quadraticCurveTo(0, 0, r, 0);
  const geometry = new T.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(r * 0.32, depth * 0.18),
    bevelThickness: Math.min(r * 0.28, depth * 0.16),
    curveSegments: 4,
  });
  geometry.translate(-width / 2, -height / 2, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function tubeBetween(a: T.Vector3, b: T.Vector3, radius: number) {
  const middle = a.clone().lerp(b, 0.5);
  middle.y -= a.distanceTo(b) * 0.055;
  return new T.TubeGeometry(
    new T.QuadraticBezierCurve3(a, middle, b),
    18,
    radius,
    7,
    false,
  );
}

export class ReelProblems3LookdevScene implements LookdevRuntime {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(68, 1, 0.04, 220);
  private renderer: T.WebGLRenderer;
  private quality;
  private root = new T.Group();
  private atmosphere = new T.Group();
  private materials = new Map<MaterialRole, T.MeshStandardMaterial>();
  private texture = clayTexture();
  private water!: SculptedWater;
  private grass: T.Object3D[] = [];
  private clouds: T.Object3D[] = [];
  private birds: T.Object3D[] = [];
  private fish = new T.Group();
  private fishLight = new T.PointLight();
  private beaconLens = new T.Mesh();
  private beaconLight = new T.PointLight();
  private beaconBeam = new T.Mesh();
  private beaconInteraction = new T.Mesh();
  private rain = new T.Points<T.BufferGeometry, T.PointsMaterial>();
  private motes = new T.Points<T.BufferGeometry, T.PointsMaterial>();
  private hands = new T.Group();
  private sun = new T.DirectionalLight();
  private hemi = new T.HemisphereLight();
  private resize: ResizeObserver;
  private frame = 0;
  private previous = performance.now();
  private statsAt = 0;
  private frameTimes: number[] = [];
  private pose: PlayerPose = { ...START_POSE };
  private input: LookdevInput = { ...ZERO_INPUT };
  private style: LookStyleId = 'storybook';
  private reducedMotion = false;
  private beaconLit = false;
  private selected: 'beacon' | null = null;
  private disposed = false;
  private onPointerMove: (event: PointerEvent) => void;
  private onCanvasClick: () => void;
  private onPointerLock: () => void;

  constructor(
    private host: HTMLElement,
    private onTarget: (target: 'beacon' | null) => void,
    private onStats: (stats: LookdevStats) => void,
    private onBeacon: (lit: boolean) => void,
  ) {
    const built = createRenderer(host, {
      label:
        'Playable Reel Problems 3 visual comparison. Use WASD to move, mouse to look, and E to light the beacon.',
      shadows: 'soft',
      exposure: LOOK_STYLES.storybook.exposure,
      weight: 'heavy',
    });
    this.renderer = built.renderer;
    this.quality = built.quality;
    this.renderer.domElement.dataset.lookdevCanvas = 'true';
    this.renderer.domElement.style.touchAction = 'none';
    this.scene.add(this.root, this.atmosphere);
    this.buildMaterials();
    this.buildWorld();
    this.buildLights();
    this.buildHands();
    this.applyStyle('storybook');
    this.reset();

    this.onPointerMove = (event) => {
      if (document.pointerLockElement === this.renderer.domElement)
        this.look(event.movementX, event.movementY);
    };
    this.onCanvasClick = () => {
      this.renderer.domElement.focus();
      if (document.pointerLockElement !== this.renderer.domElement)
        void this.renderer.domElement.requestPointerLock?.();
    };
    this.onPointerLock = () =>
      this.host.classList.toggle(
        'is-looking',
        document.pointerLockElement === this.renderer.domElement,
      );
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerlockchange', this.onPointerLock);
    this.renderer.domElement.addEventListener('click', this.onCanvasClick);

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    this.frame = requestAnimationFrame(this.animate);
  }

  private buildMaterials() {
    for (const role of [
      'rock',
      'sand',
      'grass',
      'leaf',
      'wood',
      'paint',
      'plaster',
      'metal',
      'cloth',
      'rope',
      'glass',
      'hand',
      'sleeve',
      'fish',
    ] as MaterialRole[]) {
      const material = new T.MeshStandardMaterial({
        color: LOOK_STYLES.storybook.palette[role],
        roughness: LOOK_STYLES.storybook.roughness,
        metalness: role === 'metal' ? 0.08 : 0,
        bumpMap: this.texture,
        bumpScale: 0.018,
        flatShading: false,
      });
      if (role === 'glass' || role === 'fish') {
        material.emissive.set(LOOK_STYLES.storybook.palette[role]);
        material.emissiveIntensity = role === 'fish' ? 1.7 : 0.7;
      }
      installComicTreatment(material);
      this.materials.set(role, material);
    }
  }

  private material(role: MaterialRole) {
    return this.materials.get(role)!;
  }

  private mesh(
    geometry: T.BufferGeometry,
    role: MaterialRole,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
    outline = false,
    parent: T.Object3D = this.root,
  ) {
    const mesh = new T.Mesh(geometry, this.material(role)) as TaggedMesh;
    mesh.userData.role = role;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = !this.quality.touch && outline && role !== 'glass';
    mesh.receiveShadow = role !== 'leaf' && role !== 'cloth';
    parent.add(mesh);
    if (outline) this.addOutline(mesh);
    return mesh;
  }

  private addOutline(mesh: TaggedMesh) {
    const geometry = new T.EdgesGeometry(mesh.geometry, 32);
    const lines = new T.LineSegments(
      geometry,
      new T.LineBasicMaterial({
        color: '#173e46',
        transparent: true,
        depthWrite: false,
      }),
    );
    lines.renderOrder = 8;
    lines.scale.setScalar(1.006);
    const sketchLines = new T.LineSegments(
      geometry,
      new T.LineBasicMaterial({
        color: '#453b32',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    sketchLines.visible = false;
    sketchLines.renderOrder = 7;
    sketchLines.scale.setScalar(1.018);
    mesh.add(lines, sketchLines);
    mesh.userData.outline = lines;
    mesh.userData.sketchOutline = sketchLines;
  }

  private rounded(
    size: [number, number, number],
    position: [number, number, number],
    role: MaterialRole,
    radius = 0.16,
    rotation: [number, number, number] = [0, 0, 0],
    outline = true,
    parent?: T.Object3D,
  ) {
    return this.mesh(
      roundedBoxGeometry(...size, radius),
      role,
      position,
      rotation,
      [1, 1, 1],
      outline,
      parent,
    );
  }

  private buildWorld() {
    this.buildWater();
    this.buildDistantIslands();
    this.buildIsland();
    this.buildDockAndBoat();
    this.buildBeacon();
    this.buildShed();
    this.buildBridgeAndProps();
    this.buildFoliage();
    this.buildWildlife();
    this.buildAtmosphere();
  }

  private buildWater() {
    this.water = createSculptedWater(this.quality.touch);
    this.root.add(this.water.group);
  }

  private buildDistantIslands() {
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const distance = 54 + (i % 4) * 8;
      const group = new T.Group();
      group.position.set(
        Math.cos(angle) * distance,
        -1.7,
        Math.sin(angle) * distance,
      );
      group.rotation.y = -angle;
      this.root.add(group);
      this.mesh(
        new T.ConeGeometry(8 + (i % 3) * 3, 9 + (i % 4) * 3, 7),
        'rock',
        [0, 2.2, 0],
        [0, seeded(i) * Math.PI, 0],
        [1.3, 0.62, 0.8],
        false,
        group,
      );
      this.mesh(
        new T.ConeGeometry(7 + (i % 3) * 2, 3.5, 8),
        'grass',
        [0, 6.2 + (i % 4), 0],
        [0, seeded(i + 20) * Math.PI, 0],
        [1.2, 0.38, 0.78],
        false,
        group,
      );
    }
  }

  private buildIsland() {
    this.mesh(
      new T.CylinderGeometry(12.9, 15.8, 2.8, 28, 3),
      'rock',
      [0, -1.4, -1],
      [0, 0.04, 0],
      [1, 1, 0.92],
      true,
    );
    this.mesh(
      new T.CylinderGeometry(12.5, 13.1, 0.8, 30, 2),
      'grass',
      [0, 0.15, -1],
      [0, 0.11, 0],
      [1, 1, 0.93],
      true,
    );
    this.mesh(
      new T.SphereGeometry(6.3, 24, 14),
      'sand',
      [0, -0.25, 9.3],
      [0, 0, 0],
      [1.04, 0.16, 0.7],
      false,
    );
    for (let i = 0; i < 34; i++) {
      const angle = i * 2.399;
      const radius = 8.2 + (i % 7) * 0.76;
      const x = Math.cos(angle) * radius;
      const z = -1 + Math.sin(angle) * radius;
      if (Math.abs(x) < 2.7 && z > -8 && z < 12) continue;
      const scale = 0.45 + seeded(i + 44) * 0.7;
      this.mesh(
        new T.DodecahedronGeometry(0.85, 1),
        'rock',
        [x, 0.42 + scale * 0.2, z],
        [seeded(i) * 0.7, angle, seeded(i + 2) * 0.45],
        [scale * 1.2, scale, scale * 0.9],
        i % 5 === 0,
      );
    }
    for (const [x, z, sx, sz] of [
      [-6.4, 4.4, 2.1, 1.1],
      [7.1, 1.9, 1.5, 0.8],
      [-7.7, -4.4, 1.65, 0.9],
    ] as [number, number, number, number][]) {
      const pool = new T.Mesh(
        new T.CircleGeometry(1, 32),
        new T.MeshPhysicalMaterial({
          color: '#5fb3a8',
          roughness: 0.18,
          transmission: 0.22,
          transparent: true,
          opacity: 0.9,
          clearcoat: 0.5,
        }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.6, z);
      pool.scale.set(sx, sz, 1);
      this.root.add(pool);
      const rim = new T.Mesh(
        new T.TorusGeometry(1, 0.12, 7, 32),
        this.material('rock'),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.copy(pool.position).add(new T.Vector3(0, 0.015, 0));
      rim.scale.set(sx, sz, 1);
      this.root.add(rim);
    }
  }

  private buildDockAndBoat() {
    const dock = new T.Group();
    this.root.add(dock);
    for (let i = 0; i < 9; i++) {
      this.rounded(
        [3.7, 0.28, 1.28],
        [0, 0.42 + Math.sin(i) * 0.025, 7.1 + i * 1.04],
        'wood',
        0.1,
        [0, (i % 2 ? 1 : -1) * 0.015, 0],
        i < 2,
        dock,
      );
    }
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const post = this.mesh(
          new T.CylinderGeometry(0.15, 0.2, 2.2, 9),
          'wood',
          [side * 2.08, 0.05, 7.2 + i * 2.05],
          [0.02, 0, side * 0.03],
          [1, 1, 1],
          false,
          dock,
        );
        post.castShadow = !this.quality.touch;
      }

    const boat = new T.Group();
    boat.position.set(-7.2, -0.22, 9.2);
    boat.rotation.y = 0.13;
    this.root.add(boat);
    this.mesh(
      new T.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      'paint',
      [0, 0, 0],
      [Math.PI, 0, 0],
      [3.6, 1.2, 1.55],
      true,
      boat,
    );
    this.rounded(
      [5.7, 0.22, 2.25],
      [0, 0.55, 0],
      'wood',
      0.12,
      [0, 0, 0],
      false,
      boat,
    );
    this.mesh(
      new T.CylinderGeometry(0.11, 0.15, 5.8, 10),
      'wood',
      [0.25, 3.1, 0],
      [0, 0, 0],
      [1, 1, 1],
      false,
      boat,
    );
    const sailShape = new T.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(2.5, 0.2);
    sailShape.lineTo(0.15, 3.9);
    sailShape.closePath();
    this.mesh(
      new T.ShapeGeometry(sailShape),
      'cloth',
      [0.42, 1.2, 0],
      [0, -0.06, 0],
      [1, 1, 1],
      true,
      boat,
    );
    for (let i = 0; i < 4; i++)
      this.rounded(
        [0.42, 0.34, 0.52],
        [-1.7 + i * 0.65, 0.78, 0.12],
        i === 0 ? 'paint' : 'wood',
        0.09,
        [0, i * 0.08, 0],
        false,
        boat,
      );
  }

  private buildBeacon() {
    const tower = new T.Group();
    tower.position.set(0, 0.55, -5.8);
    this.root.add(tower);
    this.mesh(
      new T.CylinderGeometry(1.55, 2.2, 6.8, 18, 5),
      'plaster',
      [0, 3.4, 0],
      [0, 0.08, 0],
      [1, 1, 1],
      true,
      tower,
    );
    for (let i = 0; i < 4; i++) {
      const band = this.mesh(
        new T.TorusGeometry(1.58 - i * 0.09, 0.075, 8, 28),
        'paint',
        [0, 1.5 + i * 1.32, 0],
        [Math.PI / 2, 0, 0],
        [1, 1, 1],
        false,
        tower,
      );
      band.castShadow = false;
    }
    this.rounded(
      [0.62, 1.52, 0.14],
      [0, 1.25, 2.02],
      'wood',
      0.17,
      [0, 0, 0],
      true,
      tower,
    );
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.mesh(
        new T.CylinderGeometry(0.07, 0.07, 1.3, 7),
        'metal',
        [Math.cos(angle) * 1.68, 6.82, Math.sin(angle) * 1.68],
        [0, 0, 0],
        [1, 1, 1],
        false,
        tower,
      );
    }
    this.mesh(
      new T.CylinderGeometry(1.95, 1.95, 0.2, 20),
      'metal',
      [0, 6.18, 0],
      [0, 0, 0],
      [1, 1, 1],
      true,
      tower,
    );
    this.mesh(
      new T.CylinderGeometry(1.95, 1.95, 0.22, 20),
      'metal',
      [0, 7.38, 0],
      [0, 0, 0],
      [1, 1, 1],
      true,
      tower,
    );
    this.mesh(
      new T.ConeGeometry(2.2, 1.15, 20),
      'paint',
      [0, 8.02, 0],
      [0, 0.1, 0],
      [1, 1, 1],
      true,
      tower,
    );
    this.beaconLens = this.mesh(
      new T.SphereGeometry(0.62, 20, 14),
      'glass',
      [0, 6.78, 0],
      [0, 0, 0],
      [1, 0.82, 1],
      false,
      tower,
    );
    this.beaconLight = new T.PointLight('#7ef0ce', 0, 28, 1.6);
    this.beaconLight.position.set(0, 6.78, 0);
    tower.add(this.beaconLight);
    this.beaconBeam = new T.Mesh(
      new T.ConeGeometry(3.1, 17, 24, 1, true),
      new T.MeshBasicMaterial({
        color: '#7ef0ce',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
      }),
    );
    this.beaconBeam.position.set(0, 6.78, -7.8);
    this.beaconBeam.rotation.x = Math.PI / 2;
    tower.add(this.beaconBeam);
    this.beaconInteraction = new T.Mesh(
      new T.SphereGeometry(2.15, 12, 8),
      new T.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.beaconInteraction.position.set(0, 1.8, 2.1);
    this.beaconInteraction.userData.target = 'beacon';
    tower.add(this.beaconInteraction);
    const wheel = new T.Group();
    wheel.position.set(0, 1.8, 2.18);
    tower.add(wheel);
    this.mesh(
      new T.TorusGeometry(0.72, 0.09, 9, 24),
      'metal',
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 1],
      true,
      wheel,
    );
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const end = new T.Vector3(
        Math.cos(angle) * 0.78,
        Math.sin(angle) * 0.78,
        0,
      );
      this.mesh(
        new T.CylinderGeometry(0.045, 0.045, 0.78, 7),
        'metal',
        [end.x / 2, end.y / 2, 0],
        [0, 0, -angle + Math.PI / 2],
        [1, 1, 1],
        false,
        wheel,
      );
    }
  }

  private buildShed() {
    const shed = new T.Group();
    shed.position.set(-6.5, 0.7, -1.8);
    shed.rotation.y = 0.12;
    this.root.add(shed);
    this.rounded(
      [4.7, 3.4, 3.9],
      [0, 1.7, 0],
      'paint',
      0.22,
      [0, 0, 0],
      true,
      shed,
    );
    this.mesh(
      new T.ConeGeometry(3.55, 2, 4),
      'wood',
      [0, 4.1, 0],
      [0, Math.PI / 4, 0],
      [1, 1, 0.84],
      true,
      shed,
    );
    this.rounded(
      [1.05, 2.15, 0.18],
      [0.8, 1.1, 2],
      'wood',
      0.22,
      [0, 0, 0],
      true,
      shed,
    );
    this.rounded(
      [0.92, 0.92, 0.17],
      [-1.2, 2.1, 2.01],
      'glass',
      0.18,
      [0, 0, 0],
      true,
      shed,
    );
    this.rounded(
      [0.92, 0.92, 0.17],
      [1.5, 2.2, 2.01],
      'glass',
      0.18,
      [0, 0, 0],
      true,
      shed,
    );
    for (let i = 0; i < 4; i++)
      this.mesh(
        new T.CylinderGeometry(0.03, 0.035, 2.6, 6),
        'rope',
        [-2.05 + i * 0.16, 1.45, 2.15],
        [0, 0, 0.15],
        [1, 1, 1],
        false,
        shed,
      );
  }

  private buildBridgeAndProps() {
    const bridge = new T.Group();
    bridge.position.set(6.5, 1.15, -2.8);
    bridge.rotation.y = -0.42;
    this.root.add(bridge);
    for (let i = 0; i < 10; i++)
      this.rounded(
        [1.55, 0.16, 0.42],
        [0, -i * 0.025, -2 + i * 0.46],
        'wood',
        0.07,
        [0, ((i % 2) - 0.5) * 0.07, 0],
        false,
        bridge,
      );
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++)
        this.mesh(
          new T.CylinderGeometry(0.055, 0.065, 1.55, 7),
          'wood',
          [side * 0.88, 0.6, -1.8 + i * 1.8],
          [0, 0, side * 0.05],
          [1, 1, 1],
          false,
          bridge,
        );
      this.mesh(
        tubeBetween(
          new T.Vector3(side * 0.88, 1.24, -2.2),
          new T.Vector3(side * 0.88, 1.2, 2.4),
          0.045,
        ),
        'rope',
        [0, 0, 0],
        [0, 0, 0],
        [1, 1, 1],
        false,
        bridge,
      );
    }

    for (let i = 0; i < 8; i++) {
      const x = -4.6 + (i % 4) * 1.15;
      const z = 3.4 + Math.floor(i / 4) * 1.05;
      this.rounded(
        [0.82, 0.62, 0.82],
        [x, 0.92, z],
        i % 3 === 0 ? 'paint' : 'wood',
        0.13,
        [0, seeded(i) * 0.18, 0],
        i === 0,
      );
    }
    for (let i = 0; i < 7; i++) {
      const buoy = new T.Group();
      buoy.position.set(
        4.8 + (i % 3) * 0.56,
        1 + Math.floor(i / 3) * 0.53,
        4.3,
      );
      this.root.add(buoy);
      this.mesh(
        new T.SphereGeometry(0.25, 12, 9),
        i % 2 ? 'paint' : 'cloth',
        [0, 0, 0],
        [0, 0, 0],
        [1, 1.25, 1],
        true,
        buoy,
      );
      this.mesh(
        new T.TorusGeometry(0.14, 0.035, 6, 14),
        'rope',
        [0, 0.3, 0],
        [Math.PI / 2, 0, 0],
        [1, 1, 1],
        false,
        buoy,
      );
    }
    for (let i = 0; i < 5; i++) {
      const post = this.mesh(
        new T.CylinderGeometry(0.13, 0.18, 2.2, 8),
        'wood',
        [-5.2 + i * 2.5, 1.05, 6.6 + Math.sin(i) * 0.5],
        [0.02, 0, (i - 2) * 0.025],
        [1, 1, 1],
        false,
      );
      if (i > 0) {
        const previousX = -5.2 + (i - 1) * 2.5;
        const previousZ = 6.6 + Math.sin(i - 1) * 0.5;
        this.mesh(
          tubeBetween(
            new T.Vector3(previousX, 1.72, previousZ),
            new T.Vector3(post.position.x, 1.72, post.position.z),
            0.035,
          ),
          'rope',
          [0, 0, 0],
          [0, 0, 0],
          [1, 1, 1],
          false,
        );
      }
    }
  }

  private buildFoliage() {
    for (let i = 0; i < (this.quality.touch ? 52 : 96); i++) {
      const angle = i * 2.399;
      const radius = 3.7 + seeded(i + 70) * 8.4;
      const x = Math.cos(angle) * radius;
      const z = -1 + Math.sin(angle) * radius;
      if (Math.abs(x) < 2.8 && z > -8 && z < 12) continue;
      const blade = this.mesh(
        new T.ConeGeometry(
          0.12 + seeded(i) * 0.09,
          0.72 + seeded(i + 3) * 0.68,
          5,
        ),
        i % 5 === 0 ? 'leaf' : 'grass',
        [x, 0.86, z],
        [0.08, angle, (seeded(i + 2) - 0.5) * 0.22],
        [1, 1, 0.72],
        false,
      );
      blade.userData.phase = seeded(i + 1) * Math.PI * 2;
      this.grass.push(blade);
    }
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.23;
      const radius = 7.4 + (i % 3) * 1.5;
      const x = Math.cos(angle) * radius;
      const z = -1 + Math.sin(angle) * radius;
      if (z > 6) continue;
      const tree = new T.Group();
      tree.position.set(x, 0.65, z);
      tree.rotation.z = Math.sin(angle) * 0.08;
      this.root.add(tree);
      this.mesh(
        new T.CylinderGeometry(0.16, 0.28, 2.7, 9),
        'wood',
        [0, 1.35, 0],
        [0.03, 0, 0],
        [1, 1, 1],
        false,
        tree,
      );
      for (let crown = 0; crown < 3; crown++)
        this.mesh(
          new T.IcosahedronGeometry(0.9, 2),
          'leaf',
          [(crown - 1) * 0.5, 2.6 + crown * 0.32, 0],
          [0, angle + crown, 0],
          [1.2, 1, 0.8],
          crown === 1,
          tree,
        );
      tree.userData.phase = angle;
      this.grass.push(tree);
    }
  }

  private buildWildlife() {
    this.fish.position.set(0, -1.55, 5);
    this.root.add(this.fish);
    this.mesh(
      new T.SphereGeometry(1, 24, 14),
      'fish',
      [0, 0, 0],
      [0, 0, 0],
      [2.5, 0.72, 0.78],
      false,
      this.fish,
    );
    this.mesh(
      new T.ConeGeometry(0.92, 1.6, 4),
      'fish',
      [-2.75, 0, 0],
      [0, 0, Math.PI / 2],
      [1, 1, 1],
      false,
      this.fish,
    );
    this.mesh(
      new T.ConeGeometry(0.56, 1.2, 4),
      'fish',
      [0, 0.72, 0],
      [0, 0, 0],
      [1, 1, 1],
      false,
      this.fish,
    );
    this.mesh(
      new T.SphereGeometry(0.09, 10, 8),
      'metal',
      [1.93, 0.18, -0.62],
      [0, 0, 0],
      [1, 1, 0.6],
      false,
      this.fish,
    );
    this.fishLight = new T.PointLight('#79edcf', 11, 27, 1.6);
    this.fish.add(this.fishLight);
    for (let i = 0; i < 4; i++) {
      const bird = new T.Group();
      const left = new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(-0.65, 0, 0),
          new T.Vector3(0, 0.18, 0),
          new T.Vector3(0.65, 0, 0),
        ]),
        new T.LineBasicMaterial({ color: '#173e46' }),
      );
      bird.add(left);
      bird.position.set(-12 + i * 7, 10 + (i % 2) * 2, -18 - i * 4);
      bird.userData.phase = i * 1.7;
      this.birds.push(bird);
      this.atmosphere.add(bird);
    }
  }

  private buildAtmosphere() {
    for (let i = 0; i < 7; i++) {
      const cloud = new T.Group();
      for (let puff = 0; puff < 4; puff++)
        this.mesh(
          new T.IcosahedronGeometry(1.8 + seeded(i * 5 + puff), 2),
          'cloth',
          [(puff - 2) * 1.5, seeded(i + puff) * 0.8, 0],
          [0, 0, 0],
          [1.4, 0.72, 0.75],
          false,
          cloud,
        );
      cloud.position.set(-44 + i * 12, 15 + (i % 3) * 3, -36 - (i % 2) * 12);
      cloud.scale.setScalar(1.2 + seeded(i) * 1.1);
      cloud.userData.phase = i;
      this.clouds.push(cloud);
      this.atmosphere.add(cloud);
    }

    const makePoints = (count: number, color: string, size: number) => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (seeded(i * 3) - 0.5) * 44;
        positions[i * 3 + 1] = seeded(i * 3 + 1) * 18;
        positions[i * 3 + 2] = (seeded(i * 3 + 2) - 0.5) * 50;
      }
      return new T.Points(
        new T.BufferGeometry().setAttribute(
          'position',
          new T.BufferAttribute(positions, 3),
        ),
        new T.PointsMaterial({
          color,
          size,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        }),
      );
    };
    this.rain = makePoints(this.quality.touch ? 500 : 1_150, '#c0d9dd', 0.055);
    this.rain.visible = false;
    this.atmosphere.add(this.rain);
    this.motes = makePoints(this.quality.touch ? 28 : 70, '#ffe0a0', 0.055);
    this.atmosphere.add(this.motes);
  }

  private buildLights() {
    this.hemi = new T.HemisphereLight('#ddf4ea', '#274d50', 1.9);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight('#ffd594', 4.2);
    this.sun.position.set(-14, 23, 13);
    this.sun.castShadow = !this.quality.touch;
    this.sun.shadow.mapSize.set(
      this.quality.shadowMapSize,
      this.quality.shadowMapSize,
    );
    this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -25;
    this.sun.shadow.camera.right = this.sun.shadow.camera.top = 25;
    this.sun.shadow.bias = -0.00025;
    this.scene.add(this.sun);
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    const warmFill = new T.PointLight('#ef9b62', 1.2, 18, 2);
    warmFill.position.set(-6, 3.4, 0);
    this.scene.add(warmFill);
  }

  private buildHands() {
    this.camera.add(this.hands);
    this.scene.add(this.camera);
    for (const side of [-1, 1]) {
      this.mesh(
        new T.CapsuleGeometry(0.1, 0.42, 6, 10),
        'sleeve',
        [side * 0.34, -0.4, -0.72],
        [-0.82, 0, side * 0.16],
        [1, 1, 1],
        false,
        this.hands,
      );
      this.mesh(
        new T.SphereGeometry(0.13, 16, 11),
        'hand',
        [side * 0.32, -0.54, -0.96],
        [0, 0, 0],
        [0.86, 1.12, 0.78],
        false,
        this.hands,
      );
    }
    this.hands.scale.setScalar(0.68);
    this.hands.position.y = -0.035;
  }

  private applyStyle(id: LookStyleId) {
    const style = LOOK_STYLES[id];
    const comic = COMIC_TREATMENTS[style.comic];
    this.style = id;
    this.scene.background = new T.Color(style.palette.sky);
    this.scene.fog = new T.FogExp2(style.palette.fog, style.fogDensity);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = style.exposure;
    this.hemi.color.set(
      id === 'stormlight'
        ? '#a9cbd0'
        : style.comic === 'noir'
          ? '#687682'
          : style.comic === 'sketch'
            ? '#f5e8c4'
            : style.comic === 'adventure'
              ? '#e7fff2'
              : '#ddf4ea',
    );
    this.hemi.groundColor.set(
      id === 'graphic' || style.comic === 'adventure'
        ? '#39645c'
        : style.comic === 'noir'
          ? '#0d1722'
          : style.comic === 'sketch'
            ? '#756a57'
            : '#274d50',
    );
    this.hemi.intensity = style.hemiIntensity;
    this.sun.color.set(style.palette.sun);
    this.sun.intensity = style.sunIntensity;
    this.sun.position.set(
      id === 'stormlight' || style.comic === 'noir' ? -19 : -14,
      id === 'stormlight' || style.comic === 'noir' ? 15 : 23,
      id === 'stormlight' || style.comic === 'noir' ? -8 : 13,
    );
    for (const [role, material] of this.materials) {
      material.color.set(style.palette[role]);
      material.roughness =
        role === 'metal'
          ? Math.max(0.35, style.roughness - 0.2)
          : style.roughness;
      material.metalness =
        role === 'metal' ? 0.12 + style.metalness : style.metalness;
      material.bumpScale =
        id === 'graphic' ||
        style.comic === 'adventure' ||
        style.comic === 'noir'
          ? 0
          : id === 'stormlight'
            ? 0.028
            : style.comic === 'sketch'
              ? 0.01
              : 0.018;
      material.flatShading =
        id === 'graphic' ||
        style.comic === 'adventure' ||
        style.comic === 'noir';
      applyComicTreatment(material, style.comic);
      if (role === 'glass' || role === 'fish') {
        material.emissive.set(style.palette[role]);
        material.emissiveIntensity =
          role === 'fish' ? 1.8 : this.beaconLit ? 2.2 : 0.55;
      }
      material.needsUpdate = true;
    }
    this.water.setStyle(id);
    this.root.traverse((object) => {
      const outline = (object as TaggedMesh).userData.outline;
      if (!outline) return;
      outline.visible = style.edgeStrength > 0;
      (outline.material as T.LineBasicMaterial).color.set(style.palette.ink);
      (outline.material as T.LineBasicMaterial).opacity = style.edgeStrength;
      outline.scale.setScalar(comic.outlineScale);
      const sketchOutline = (object as TaggedMesh).userData.sketchOutline;
      if (sketchOutline) {
        sketchOutline.visible = comic.ghostOpacity > 0;
        sketchOutline.scale.setScalar(
          comic.outlineScale + 0.006 + (object.id % 3) * 0.0015,
        );
        (sketchOutline.material as T.LineBasicMaterial).color.set(
          style.palette.ink,
        );
        (sketchOutline.material as T.LineBasicMaterial).opacity =
          comic.ghostOpacity;
      }
    });
    this.rain.visible = style.rain > 0 && !this.reducedMotion;
    this.motes.visible = style.ambientParticles > 0 && id !== 'stormlight';
    (this.motes.material as T.PointsMaterial).color.set(
      style.comic === 'noir'
        ? '#ffbd55'
        : style.comic === 'sketch'
          ? '#f2d89d'
          : id === 'graphic' || style.comic === 'adventure'
            ? '#fff0a0'
            : '#ffd995',
    );
    this.fishLight.color.set(style.palette.fish);
    this.beaconLight.color.set(style.palette.beacon);
    (this.beaconBeam.material as T.MeshBasicMaterial).color.set(
      style.palette.beacon,
    );
    this.host.dataset.style = id;
  }

  setStyle(style: LookStyleId) {
    if (style === this.style) return;
    this.applyStyle(style);
  }

  setInput(input: LookdevInput) {
    this.input = input;
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
    this.water.setReducedMotion(reduced);
    this.applyStyle(this.style);
  }

  look(deltaX: number, deltaY: number) {
    this.pose = lookPose(this.pose, deltaX, deltaY);
  }

  activateBeacon() {
    if (this.selected !== 'beacon') return false;
    this.beaconLit = !this.beaconLit;
    this.beaconLight.intensity = this.beaconLit
      ? this.style === 'stormlight'
        ? 18
        : 12
      : 0;
    (this.beaconBeam.material as T.MeshBasicMaterial).opacity = this.beaconLit
      ? this.style === 'graphic'
        ? 0.24
        : 0.16
      : 0;
    const glass = this.material('glass');
    glass.emissiveIntensity = this.beaconLit ? 2.2 : 0.55;
    this.onBeacon(this.beaconLit);
    return true;
  }

  reset() {
    this.pose = { ...START_POSE };
    this.input = { ...ZERO_INPUT };
    this.beaconLit = false;
    this.beaconLight.intensity = 0;
    (this.beaconBeam.material as T.MeshBasicMaterial).opacity = 0;
    this.material('glass').emissiveIntensity = 0.55;
    this.onBeacon(false);
    this.syncCamera(0);
  }

  target() {
    return this.selected;
  }

  private terrainHeight(x: number, z: number) {
    if (Math.abs(x) < 2.35 && z > 6.5) return 0.54;
    if (Math.hypot(x, z + 1) < 12.7) return 0.69;
    return 0.2;
  }

  private syncCamera(seconds: number) {
    const moving =
      Math.abs(this.input.forward) + Math.abs(this.input.strafe) > 0.05;
    const bob =
      this.reducedMotion || !moving ? 0 : Math.sin(seconds * 9.2) * 0.025;
    this.camera.position.set(
      this.pose.x,
      this.terrainHeight(this.pose.x, this.pose.z) + 1.55 + bob,
      this.pose.z,
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pose.pitch, this.pose.yaw, 0);
    const handSway = this.reducedMotion
      ? 0
      : Math.sin(seconds * (moving ? 8.5 : 1.8)) * (moving ? 0.016 : 0.006);
    this.hands.position.set(handSway, -0.035 - Math.abs(handSway) * 0.3, 0);
  }

  private updateTarget() {
    const target = new T.Vector3();
    this.beaconInteraction.getWorldPosition(target);
    const direction = target.clone().sub(this.camera.position);
    const distance = direction.length();
    const facing = new T.Vector3(0, 0, -1).applyQuaternion(
      this.camera.quaternion,
    );
    const next =
      distance < 26 && facing.dot(direction.normalize()) > 0.93
        ? 'beacon'
        : null;
    if (next !== this.selected) {
      this.selected = next;
      this.onTarget(next);
    }
  }

  private animate = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const deltaMs = Math.min(80, Math.max(0, now - this.previous));
    const delta = deltaMs / 1000;
    this.previous = now;
    const seconds = now / 1000;
    this.frameTimes.push(deltaMs);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    if (now - this.statsAt > 700) {
      this.statsAt = now;
      this.onStats(summarizeFrames(this.frameTimes));
    }
    this.pose = movePose(this.pose, this.input, delta);
    this.syncCamera(seconds);
    this.updateTarget();

    const style = LOOK_STYLES[this.style];
    const motion = this.reducedMotion ? 0.08 : 1;
    for (let i = 0; i < this.grass.length; i++) {
      const plant = this.grass[i];
      const phase = Number(plant.userData.phase ?? i);
      plant.rotation.z +=
        (Math.sin(seconds * 1.7 + phase) * 0.045 * style.wind * motion -
          plant.rotation.z) *
        0.05;
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      cloud.position.x += delta * (0.32 + style.wind * 0.3) * motion;
      if (cloud.position.x > 58) cloud.position.x = -58;
      cloud.rotation.y = Math.sin(seconds * 0.06 + i) * 0.08;
    }
    for (let i = 0; i < this.birds.length; i++) {
      const bird = this.birds[i];
      bird.position.x += delta * (1.1 + i * 0.15) * motion;
      bird.position.y += Math.sin(seconds * 1.4 + i) * 0.002 * motion;
      if (bird.position.x > 28) bird.position.x = -28;
    }
    this.fish.position.set(
      Math.sin(seconds * 0.32) * 8,
      -1.65 + Math.sin(seconds * 1.1) * 0.18,
      3 + Math.cos(seconds * 0.32) * 5.5,
    );
    this.fish.rotation.y = -seconds * 0.32 + Math.PI / 2;
    this.water.setFish(this.fish.position, -0.68 - this.fish.position.y);
    this.water.update(seconds);
    if (this.beaconLit) this.beaconBeam.rotation.z = seconds * 0.24;
    if (this.rain.visible) {
      const positions = this.rain.geometry.attributes
        .position as T.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i) - delta * 13;
        if (y < 0) y += 19;
        positions.setY(i, y);
        positions.setX(i, positions.getX(i) - delta * 2.2);
      }
      positions.needsUpdate = true;
    }
    this.motes.rotation.y = seconds * 0.015;
    this.renderer.render(this.scene, this.camera);
  };

  private fit() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    this.renderer.domElement.removeEventListener('click', this.onCanvasClick);
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock?.();
    this.root.remove(this.water.group);
    this.water.dispose();
    disposeObject(this.scene);
    for (const material of this.materials.values()) material.dispose();
    this.texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
