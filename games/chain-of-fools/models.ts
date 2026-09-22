import { createSiteDetails, type SiteDetails } from './site-details';
import * as T from 'three';
import {
  ball,
  beam,
  box,
  label,
  material,
  taper,
} from '../../shared/rendering/primitives';
import {
  ANCHORS,
  CHECKPOINTS,
  COURSE_END_X,
  FINISH_X,
  NET,
  PENDULUM,
  PLANK,
  SURFACES,
  type Box,
  type SurfaceKind,
} from './course';

/** A canvas label that keeps its colours: no fog, no tone mapping. */
function sign(text: string, bg: string, fg: string, width: number) {
  const sprite = label(text, bg, fg, width);
  sprite.material.fog = false;
  sprite.material.toneMapped = false;
  if (sprite.material.map) sprite.material.map.colorSpace = T.SRGBColorSpace;
  return sprite;
}

/** The site's palette: dusty, warm, rusted, with hi-vis where it matters. */
export const SITE = {
  sky: '#a9cfd8',
  fog: '#e2d5bb',
  // A step darker than a house sand, so hard hats and hi-vis stand out on the
  // yard under the collection's bright house light.
  dirt: '#a88b61',
  dirtDark: '#806848',
  rust: '#b4552f',
  rustDark: '#86391f',
  steel: '#7d888c',
  steelDark: '#565f63',
  concrete: '#bdb4a4',
  concreteDark: '#958b7b',
  timber: '#c9914f',
  timberDark: '#9c6a36',
  hazard: '#f1c232',
  hazardDark: '#2b2a28',
  hiVis: '#f08a24',
  office: '#e8b94a',
  pit: '#4d4033',
  ring: '#f1c232',
};

const SURFACE_COLOURS: Record<SurfaceKind, [string, string]> = {
  yard: [SITE.dirt, SITE.dirtDark],
  girder: [SITE.rust, SITE.rustDark],
  catwalk: [SITE.steel, SITE.steelDark],
  crate: [SITE.timber, SITE.timberDark],
  scaffold: [SITE.timber, SITE.steel],
  ledge: [SITE.concrete, SITE.concreteDark],
  pipe: [SITE.steel, SITE.steelDark],
  'pipe-roof': [SITE.steel, SITE.steelDark],
  pad: [SITE.dirt, SITE.dirtDark],
  office: [SITE.concrete, SITE.concreteDark],
};

function size(b: Box): [number, number, number] {
  return [b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ];
}

function centre(b: Box): [number, number, number] {
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2];
}

/** Yellow and black warning stripes along one long edge of a deck. */
function hazardEdge(
  parent: T.Object3D,
  x0: number,
  x1: number,
  y: number,
  z: number,
) {
  const stripe = 0.6;
  for (let x = x0, i = 0; x < x1 - 0.01; x += stripe, i++) {
    const w = Math.min(stripe, x1 - x);
    const m = box(
      parent,
      [w, 0.06, 0.14],
      [x + w / 2, y + 0.03, z],
      i % 2 === 0 ? SITE.hazard : SITE.hazardDark,
    );
    m.castShadow = false;
  }
}

/** An I-beam: a web with top and bottom flanges, rivets along the top. */
function girder(parent: T.Object3D, b: Box) {
  const [w, , d] = size(b);
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  box(parent, [w, 0.14, d], [cx, b.maxY - 0.07, cz], SITE.rust);
  box(parent, [w, 0.12, d * 0.8], [cx, b.minY - 0.5, cz], SITE.rustDark);
  box(parent, [w, 0.5, 0.18], [cx, b.minY - 0.2, cz], SITE.rustDark);
  for (let x = b.minX + 0.4; x < b.maxX; x += 0.8) {
    for (const z of [b.minZ + 0.18, b.maxZ - 0.18]) {
      const rivet = box(
        parent,
        [0.08, 0.04, 0.08],
        [x, b.maxY + 0.01, z],
        '#7a3219',
      );
      rivet.castShadow = false;
    }
  }
}

/** Galvanised scaffold: tube legs to the ground and a timber board deck. */
function scaffoldTower(parent: T.Object3D, b: Box) {
  const [w, h, d] = size(b);
  const [cx, cy, cz] = centre(b);
  box(parent, [w, h, d], [cx, cy, cz], SITE.timber);
  for (let z = b.minZ + 0.3; z < b.maxZ; z += 0.62) {
    const plank = box(
      parent,
      [w - 0.04, 0.02, 0.05],
      [cx, b.maxY + 0.005, z],
      SITE.timberDark,
    );
    plank.castShadow = false;
  }
  const floor = -1.2;
  for (const x of [b.minX + 0.1, b.maxX - 0.1])
    for (const z of [b.minZ + 0.1, b.maxZ - 0.1]) {
      beam(parent, [x, floor, z], [x, b.maxY + 1.1, z], 0.09, SITE.steel);
    }
  // Guard rail on the drop side only, so the camera side stays open.
  beam(
    parent,
    [b.minX + 0.1, b.maxY + 1.0, b.minZ + 0.1],
    [b.maxX - 0.1, b.maxY + 1.0, b.minZ + 0.1],
    0.06,
    SITE.steel,
  );
  beam(
    parent,
    [b.minX + 0.1, floor + 0.2, b.minZ + 0.1],
    [b.maxX - 0.1, b.maxY - 0.2, b.maxZ - 0.1],
    0.06,
    SITE.steelDark,
  );
}

/** Slab with a slightly darker underside, and hazard tape on exposed edges. */
function slab(parent: T.Object3D, b: Box, stripes: boolean) {
  const [top, under] = SURFACE_COLOURS[b.kind];
  const [w, h, d] = size(b);
  const [cx, , cz] = centre(b);
  box(parent, [w, h * 0.35, d], [cx, b.maxY - h * 0.175, cz], top);
  box(
    parent,
    [w * 0.98, h * 0.65, d * 0.98],
    [cx, b.minY + h * 0.325, cz],
    under,
  );
  if (stripes) {
    hazardEdge(parent, b.minX, b.maxX, b.maxY, b.minZ + 0.07);
    hazardEdge(parent, b.minX, b.maxX, b.maxY, b.maxZ - 0.07);
  }
}

/** Grating catwalk hung from the girders above it. */
function catwalk(parent: T.Object3D, b: Box) {
  const [w, , d] = size(b);
  const [cx, , cz] = centre(b);
  box(parent, [w, 0.12, d], [cx, b.maxY - 0.06, cz], SITE.steel);
  for (let x = b.minX + 0.25; x < b.maxX; x += 0.5) {
    const bar = box(
      parent,
      [0.05, 0.02, d - 0.1],
      [x, b.maxY + 0.01, cz],
      SITE.steelDark,
    );
    bar.castShadow = false;
  }
}

export type SiteModel = {
  root: T.Group;
  plank: T.Group;
  pendulum: T.Group;
  pendulumBall: T.Object3D;
  /** Materials of the pipe's roof, faded out while the local worker is inside. */
  pipeRoof: T.MeshStandardMaterial;
  checkpointFlags: T.Mesh[];
  anchors: Map<string, T.Group>;
  dust: T.Points;
  details: SiteDetails;
};

export function createSite(): SiteModel {
  const root = new T.Group();

  // The pit everything is built over. Far enough down to read as a real drop.
  const pit = new T.Mesh(new T.PlaneGeometry(260, 70), material(SITE.pit));
  pit.rotation.x = -Math.PI / 2;
  pit.position.set(70, -30, 0);
  pit.receiveShadow = true;
  root.add(pit);
  for (let i = 0; i < 38; i++) {
    const x = 14 + ((i * 37) % 110);
    const z = -14 + ((i * 53) % 28);
    const s = 0.8 + (i % 4) * 0.6;
    const rubble = box(
      root,
      [s, s * 0.6, s * 0.9],
      [x, -30 + s * 0.3, z],
      i % 3 ? SITE.concreteDark : SITE.rustDark,
    );
    rubble.rotation.set(i * 0.4, i * 0.7, i * 0.3);
    rubble.castShadow = false;
  }

  // Ground beyond the pit at both ends, so the site sits in a landscape.
  const groundStart = box(root, [40, 1, 90], [-26, -0.5, 0], SITE.dirt);
  groundStart.castShadow = false;
  const groundEnd = box(
    root,
    [60, 1, 90],
    [COURSE_END_X + 30, -0.5, 0],
    SITE.dirt,
  );
  groundEnd.castShadow = false;

  for (const b of SURFACES) {
    if (b.kind === 'girder') girder(root, b);
    else if (b.kind === 'catwalk') catwalk(root, b);
    else if (b.kind === 'scaffold' && b.id !== 'scaffold-base')
      scaffoldTower(root, b);
    else if (b.kind === 'pipe' || b.kind === 'pipe-roof') continue;
    else if (b.kind === 'crate') crate(root, b);
    else slab(root, b, b.kind === 'ledge' || b.id === 'scaffold-base');
  }

  const pipeRoof = pipe(root);
  const plank = tippingPlank(root);
  const { group: pendulum, ball: pendulumBall } = wreckingLoad(root);
  cargoNet(root);
  const anchors = anchorRings(root);
  const checkpointFlags = flags(root);
  siteOffice(root);
  siteGate(root);
  finalCrossing(root);
  skyline(root);
  const dust = dustMotes(root);
  const details = createSiteDetails(root);

  return {
    root,
    plank,
    pendulum,
    pendulumBall,
    pipeRoof,
    checkpointFlags,
    anchors,
    dust,
    details,
  };
}

/** Paint the new challenges into the world, with a clear take-off line. */
function finalCrossing(parent: T.Object3D) {
  for (const id of ['cargo-left', 'cargo-right']) {
    const load = SURFACES.find((b) => b.id === id)!;
    hazardEdge(parent, load.minX, load.maxX, load.maxY, load.minZ + 0.07);
    hazardEdge(parent, load.minX, load.maxX, load.maxY, load.maxZ - 0.07);
  }
  for (const x of [147, 149, 156, 158, 165, 168, 171]) {
    const arrow = new T.Shape();
    arrow.moveTo(0.55, 0);
    arrow.lineTo(-0.35, 0.4);
    arrow.lineTo(-0.1, 0);
    arrow.lineTo(-0.35, -0.4);
    arrow.closePath();
    const paint = new T.Mesh(new T.ShapeGeometry(arrow), material(SITE.hazard));
    paint.rotation.x = -Math.PI / 2;
    paint.position.set(x, 0.015, 0);
    parent.add(paint);
  }
  for (const x of [150.4, 154.1]) {
    box(parent, [0.15, 0.025, 2.6], [x, 0.02, 0], SITE.hazard);
  }
}

function crate(parent: T.Object3D, b: Box) {
  const [w, h, d] = size(b);
  const [cx, cy, cz] = centre(b);
  box(parent, [w, h, d], [cx, cy, cz], SITE.timber, true);
  const slats = Math.max(1, Math.round(w / 0.5));
  for (let i = 0; i < slats; i++) {
    const x = b.minX + (i + 0.5) * (w / slats);
    for (const z of [b.minZ - 0.005, b.maxZ + 0.005]) {
      const slat = box(
        parent,
        [0.05, h * 0.9, 0.02],
        [x, cy, z],
        SITE.timberDark,
      );
      slat.castShadow = false;
    }
  }
}

/** A square steel duct. The roof is walkable, and fades while you are inside. */
function pipe(parent: T.Object3D): T.MeshStandardMaterial {
  const floor = SURFACES.find((b) => b.id === 'pipe-floor')!;
  const far = SURFACES.find((b) => b.id === 'pipe-wall-l')!;
  const near = SURFACES.find((b) => b.id === 'pipe-wall-r')!;
  slab(parent, floor, false);

  box(parent, size(far), centre(far), SITE.steelDark);
  // The camera-side wall is a cage of ribs, so the crew stays visible inside.
  for (let x = near.minX + 0.25; x < near.maxX; x += 1.4) {
    box(
      parent,
      [0.22, near.maxY - near.minY, near.maxZ - near.minZ],
      [x, (near.minY + near.maxY) / 2, (near.minZ + near.maxZ) / 2],
      SITE.steel,
    );
  }
  box(
    parent,
    [near.maxX - near.minX, 0.14, near.maxZ - near.minZ],
    [
      (near.minX + near.maxX) / 2,
      near.maxY - 0.07,
      (near.minZ + near.maxZ) / 2,
    ],
    SITE.steel,
  );

  const roofMaterial = new T.MeshStandardMaterial({
    color: SITE.steel,
    roughness: 0.8,
    flatShading: true,
    transparent: true,
    opacity: 1,
  });
  for (const id of ['pipe-roof-a', 'pipe-roof-b']) {
    const b = SURFACES.find((s) => s.id === id)!;
    const mesh = new T.Mesh(new T.BoxGeometry(...size(b)), roofMaterial);
    mesh.position.set(...centre(b));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    hazardEdge(parent, b.minX, b.maxX, b.maxY, b.minZ + 0.07);
    hazardEdge(parent, b.minX, b.maxX, b.maxY, b.maxZ - 0.07);
  }

  // Support legs down into the pit.
  for (let x = 94; x < 112; x += 6) {
    beam(parent, [x, 7.5, -1.2], [x, -30, -1.6], 0.28, SITE.rustDark);
    beam(parent, [x, 7.5, 1.2], [x, -30, 1.6], 0.28, SITE.rustDark);
  }
  return roofMaterial;
}

/** The plank and its fulcrum drum. The group rotates about the pivot. */
function tippingPlank(parent: T.Object3D): T.Group {
  const pivot = new T.Group();
  pivot.position.set(PLANK.pivotX, PLANK.y, 0);
  parent.add(pivot);
  const length = PLANK.halfLength * 2;
  const width = PLANK.maxZ - PLANK.minZ;
  box(pivot, [length, 0.16, width], [0, -0.08, 0], SITE.timber);
  for (let x = -PLANK.halfLength + 0.3; x < PLANK.halfLength; x += 0.9) {
    const grain = box(
      pivot,
      [0.05, 0.02, width - 0.1],
      [x, 0.005, 0],
      SITE.timberDark,
    );
    grain.castShadow = false;
  }
  hazardEdge(pivot, -PLANK.halfLength, PLANK.halfLength, 0, PLANK.minZ + 0.07);
  hazardEdge(pivot, -PLANK.halfLength, PLANK.halfLength, 0, PLANK.maxZ - 0.07);

  // The drum it rocks on, on a trestle down into the pit.
  const drum = taper(
    parent,
    0.45,
    0.45,
    1.6,
    [PLANK.pivotX, PLANK.y - 0.6, 0],
    SITE.hiVis,
    12,
  );
  drum.rotation.x = Math.PI / 2;
  beam(
    parent,
    [PLANK.pivotX, PLANK.y - 1.0, 0],
    [PLANK.pivotX - 1.2, -30, 0],
    0.3,
    SITE.rustDark,
  );
  beam(
    parent,
    [PLANK.pivotX, PLANK.y - 1.0, 0],
    [PLANK.pivotX + 1.2, -30, 0],
    0.3,
    SITE.rustDark,
  );
  return pivot;
}

/** A tower crane jib over the ledge with the wrecking load on its cable. */
function wreckingLoad(parent: T.Object3D): {
  group: T.Group;
  ball: T.Object3D;
} {
  const towerX = PENDULUM.pivotX + 3;
  const towerZ = -9;
  for (const dx of [-0.6, 0.6])
    for (const dz of [-0.6, 0.6])
      beam(
        parent,
        [towerX + dx, -30, towerZ + dz],
        [towerX + dx, PENDULUM.pivotY + 2, towerZ + dz],
        0.14,
        SITE.hazard,
      );
  for (let y = -28; y < PENDULUM.pivotY; y += 2.4) {
    beam(
      parent,
      [towerX - 0.6, y, towerZ - 0.6],
      [towerX + 0.6, y + 2.4, towerZ - 0.6],
      0.07,
      SITE.hazard,
    );
    beam(
      parent,
      [towerX - 0.6, y, towerZ + 0.6],
      [towerX + 0.6, y + 2.4, towerZ + 0.6],
      0.07,
      SITE.hazard,
    );
  }
  // Jib running out over the ledge to the pivot.
  box(
    parent,
    [1.2, 0.9, 16],
    [PENDULUM.pivotX, PENDULUM.pivotY + 0.6, towerZ + 7],
    SITE.hazard,
  );
  box(
    parent,
    [2.2, 1.6, 2.2],
    [towerX, PENDULUM.pivotY + 2.6, towerZ],
    SITE.hazard,
  );
  box(
    parent,
    [1.6, 1.2, 2.8],
    [towerX, PENDULUM.pivotY + 1.2, towerZ - 3],
    SITE.concreteDark,
  );
  box(
    parent,
    [0.9, 0.5, 0.9],
    [PENDULUM.pivotX, PENDULUM.pivotY + 0.1, 0],
    SITE.steelDark,
  );

  const group = new T.Group();
  group.position.set(PENDULUM.pivotX, PENDULUM.pivotY, 0);
  parent.add(group);
  const cable = new T.Mesh(
    new T.CylinderGeometry(0.05, 0.05, PENDULUM.ropeLength, 6),
    material('#2c2f31'),
  );
  cable.position.y = -PENDULUM.ropeLength / 2;
  group.add(cable);
  const load = new T.Group();
  load.position.y = -PENDULUM.ropeLength;
  group.add(load);
  ball(
    load,
    [PENDULUM.ballRadius, PENDULUM.ballRadius, PENDULUM.ballRadius],
    [0, 0, 0],
    '#34393c',
    14,
  );
  taper(load, 0.22, 0.3, 0.5, [0, PENDULUM.ballRadius + 0.2, 0], '#4a5054');
  // The hook a worker can hang off to stall the swing.
  const hook = taper(
    load,
    0.06,
    0.06,
    0.7,
    [0, -PENDULUM.ballRadius - 0.3, 0],
    SITE.hazard,
  );
  hook.castShadow = false;
  const tip = box(
    load,
    [0.3, 0.08, 0.08],
    [0.12, -PENDULUM.ballRadius - 0.65, 0],
    SITE.hazard,
  );
  tip.castShadow = false;
  return { group, ball: load };
}

/** The rope grid hanging from the net deck to the pad below. */
function cargoNet(parent: T.Object3D) {
  const points: T.Vector3[] = [];
  const x = NET.x + 0.05;
  const rows = 10;
  const cols = 10;
  for (let r = 0; r <= rows; r++) {
    const y = NET.minY + ((NET.maxY - NET.minY) * r) / rows;
    for (let c = 0; c < cols; c++) {
      const z0 = NET.minZ + ((NET.maxZ - NET.minZ) * c) / cols;
      const z1 = NET.minZ + ((NET.maxZ - NET.minZ) * (c + 1)) / cols;
      const sag = Math.sin((r / rows) * Math.PI) * 0.35;
      points.push(new T.Vector3(x + sag, y, z0), new T.Vector3(x + sag, y, z1));
    }
  }
  for (let c = 0; c <= cols; c++) {
    const z = NET.minZ + ((NET.maxZ - NET.minZ) * c) / cols;
    for (let r = 0; r < rows; r++) {
      const y0 = NET.minY + ((NET.maxY - NET.minY) * r) / rows;
      const y1 = NET.minY + ((NET.maxY - NET.minY) * (r + 1)) / rows;
      const s0 = Math.sin((r / rows) * Math.PI) * 0.35;
      const s1 = Math.sin(((r + 1) / rows) * Math.PI) * 0.35;
      points.push(new T.Vector3(x + s0, y0, z), new T.Vector3(x + s1, y1, z));
    }
  }
  const net = new T.LineSegments(
    new T.BufferGeometry().setFromPoints(points),
    new T.LineBasicMaterial({ color: '#e0c58c' }),
  );
  parent.add(net);
  box(
    parent,
    [0.3, 0.3, NET.maxZ - NET.minZ + 0.4],
    [x, NET.maxY - 0.1, 0],
    SITE.rustDark,
  );
}

function anchorRings(parent: T.Object3D): Map<string, T.Group> {
  const rings = new Map<string, T.Group>();
  for (const anchor of ANCHORS) {
    const g = new T.Group();
    g.position.set(anchor.x, anchor.y - 0.3, anchor.z - 0.7);
    box(g, [0.18, 0.7, 0.18], [0, 0.35, 0], SITE.steelDark);
    const ring = new T.Mesh(
      new T.TorusGeometry(0.2, 0.05, 8, 18),
      material(SITE.ring),
    );
    ring.position.set(0, 0.8, 0);
    ring.castShadow = true;
    g.add(ring);
    g.userData.ring = ring;
    parent.add(g);
    rings.set(anchor.id, g);
  }
  return rings;
}

function flags(parent: T.Object3D): T.Mesh[] {
  const result: T.Mesh[] = [];
  for (const point of CHECKPOINTS.slice(1)) {
    const [x, y] = point.spawn;
    const pole = beam(
      parent,
      [x - 1.5, y - 0.1, -2.6],
      [x - 1.5, y + 2.4, -2.6],
      0.06,
      '#e8e4d8',
    );
    pole.castShadow = false;
    const flag = box(
      parent,
      [0.8, 0.5, 0.03],
      [x - 1.1, y + 2.1, -2.6],
      '#d5d0c4',
    );
    result.push(flag);
  }
  return result;
}

/** The portacabin at the end: the finish line runs across its front. */
function siteOffice(parent: T.Object3D) {
  const x = FINISH_X + 3.5;
  box(parent, [5, 3, 7], [x, 1.5, 0], SITE.office, true);
  box(parent, [5.3, 0.25, 7.3], [x, 3.1, 0], SITE.concreteDark);
  box(parent, [0.08, 2.1, 1.2], [x - 2.52, 1.05, 0], '#6b4a2a');
  for (const z of [-2.2, 2.2])
    box(parent, [0.08, 0.9, 1.4], [x - 2.52, 1.8, z], '#9fd3e0');
  const officeSign = sign('SITE OFFICE', '#2b2a28', '#f1c232', 3.6);
  officeSign.position.set(x - 2.6, 3.7, 0);
  parent.add(officeSign);

  // Chequered finish tape across the pad.
  for (let i = 0; i < 16; i++) {
    const tape = box(
      parent,
      [0.5, 0.03, 1],
      [FINISH_X, 0.015, -7.5 + i],
      i % 2 ? '#f4f1e4' : '#2b2a28',
    );
    tape.castShadow = false;
  }
  for (const z of [-7.8, 7.8])
    beam(parent, [FINISH_X, 0, z], [FINISH_X, 3, z], 0.12, SITE.hazard);
  const banner = sign('CLOCK IN', SITE.hiVis, '#ffffff', 4);
  banner.position.set(FINISH_X, 3.3, 0);
  parent.add(banner);
}

/** Entrance: barrier arm, cones, and the one rule of the site. */
function siteGate(parent: T.Object3D) {
  for (const z of [-4.5, 4.5])
    box(parent, [0.35, 1.2, 0.35], [-2, 0.6, z], SITE.hazardDark);
  // Boom raised off its left post, striped like the real thing.
  const boom = new T.Group();
  boom.position.set(-2, 1.2, -4.5);
  boom.rotation.x = -1.15;
  parent.add(boom);
  for (let i = 0; i < 8; i++) {
    box(
      boom,
      [0.14, 0.14, 1.05],
      [0, 0, 0.55 + i * 1.05],
      i % 2 ? SITE.hazard : '#f4f1e4',
    );
  }
  for (let i = 0; i < 6; i++) {
    const x = 4 + i * 2.2;
    for (const z of [-6.5, 6.5]) {
      taper(parent, 0.04, 0.24, 0.6, [x, 0.3, z], SITE.hiVis, 8);
      const band = taper(parent, 0.12, 0.16, 0.1, [x, 0.36, z], '#f4f1e4', 8);
      band.castShadow = false;
    }
  }
  const rule = sign('SAFETY LINE AT ALL TIMES', '#f4f1e4', '#b4552f', 5);
  rule.position.set(8, 2.8, -7);
  parent.add(rule);
  beam(parent, [8 - 2.2, 0, -7], [8 - 2.2, 2.5, -7], 0.1, SITE.steelDark);
  beam(parent, [8 + 2.2, 0, -7], [8 + 2.2, 2.5, -7], 0.1, SITE.steelDark);
}

/** Half-demolished buildings and cranes behind the course, for depth. */
function skyline(parent: T.Object3D) {
  const shells: [number, number, number, number][] = [
    [10, -30, 16, 22],
    [45, -34, 26, 18],
    [80, -36, 20, 26],
    [118, -32, 30, 20],
    [150, -28, 18, 16],
  ];
  for (const [x, z, h, w] of shells) {
    const g = new T.Group();
    g.position.set(x, -30, z);
    parent.add(g);
    const floors = Math.round(h / 3.4) + 8;
    for (let f = 0; f < floors; f++) {
      const y = f * 3.4;
      const slabMesh = box(g, [w, 0.4, 8], [0, y, 0], SITE.concrete);
      slabMesh.castShadow = false;
      // Knocked-out corners on the upper floors.
      if (f > floors - 4 && f % 2 === 0) slabMesh.scale.x = 0.55;
    }
    for (const px of [-w / 2 + 0.4, 0, w / 2 - 0.4])
      box(
        g,
        [0.5, floors * 3.4, 0.5],
        [px, (floors * 3.4) / 2, 3.6],
        SITE.concreteDark,
      ).castShadow = false;
  }
  for (const [x, z] of [
    [30, -46],
    [128, -48],
  ]) {
    beam(parent, [x, -30, z], [x, 28, z], 1.0, SITE.hazard).castShadow = false;
    box(parent, [34, 0.9, 1.1], [x + 8, 28, z], SITE.hazard).castShadow = false;
  }
}

function dustMotes(parent: T.Object3D): T.Points {
  const count = 320;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -10 + ((i * 97.13) % 170);
    positions[i * 3 + 1] = -6 + ((i * 13.7) % 24);
    positions[i * 3 + 2] = -14 + ((i * 41.9) % 28);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  const points = new T.Points(
    geometry,
    new T.PointsMaterial({
      color: '#f3e6c8',
      size: 0.09,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  parent.add(points);
  return points;
}
