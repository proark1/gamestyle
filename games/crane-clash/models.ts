import { batchScenery } from '../../shared/rendering/batch-scenery';
import * as T from 'three';
import { ball, beam, box, taper } from '../../shared/rendering/primitives';
import {
  CRANE_CONFIG,
  CRATE_CONFIGS,
  PAD_SIZE,
  PAD_Y,
  type CrateKind,
  type TeamId,
} from './types';

export function createCraneMesh(team: TeamId) {
  const root = new T.Group();
  root.name = `crane-${team}`;
  const cfg = CRANE_CONFIG[team];
  const { mast, boomY, cabinY, reachMax, color, trimColor } = cfg;

  root.position.set(mast.x, 0, mast.z);

  // 1. Stationary Base & Mast
  box(root, [2.8, 0.4, 2.8], [0, 0.2, 0], trimColor);
  box(root, [2.2, 0.3, 2.2], [0, 0.5, 0], color);

  // 4 Mast corner columns & lattice beams
  const mw = 0.9;
  for (const x of [-mw, mw]) {
    for (const z of [-mw, mw]) {
      box(root, [0.18, boomY, 0.18], [x, boomY / 2, z], color);
    }
  }

  // Cross lattices every 1.8m
  for (let y = 0.8; y < boomY - 1; y += 1.8) {
    const nextY = Math.min(y + 1.8, boomY);
    for (const z of [-mw, mw]) {
      beam(root, [-mw, y, z], [mw, nextY, z], 0.08, color);
      beam(root, [mw, y, z], [-mw, nextY, z], 0.08, color);
    }
    for (const x of [-mw, mw]) {
      beam(root, [x, y, -mw], [x, nextY, mw], 0.08, color);
      beam(root, [x, y, mw], [x, nextY, -mw], 0.08, color);
    }
  }

  // 2. Rotating Jib Assembly (rotates around Y)
  const jib = new T.Group();
  jib.position.set(0, boomY, 0);
  root.add(jib);
  root.userData.jib = jib;

  // Slewing ring pivot
  taper(jib, 1.2, 1.2, 0.5, [0, 0, 0], trimColor);

  // Operator Cabin
  const cab = new T.Group();
  cab.position.set(1.1, cabinY - boomY + 0.3, 0.9);
  box(cab, [1.4, 1.8, 1.4], [0, 0, 0], color);
  // Glass windows
  box(cab, [0.05, 1.1, 1.1], [0.71, 0.1, 0], '#95cbd8');
  box(cab, [1.1, 1.1, 0.05], [0, 0.1, 0.71], '#95cbd8');
  jib.add(cab);

  // Tower Peak / Apex
  beam(jib, [0, 0, 0], [0, 3.2, 0], 0.18, trimColor);
  beam(jib, [0, 3.2, 0], [reachMax * 0.5, 0.5, 0], 0.1, color);
  beam(jib, [0, 3.2, 0], [-4.2, 0.5, 0], 0.1, trimColor);

  // Main Jib Rails (extends forward along +X)
  box(jib, [reachMax + 1, 0.22, 0.7], [(reachMax + 1) / 2, 0, 0], color);
  box(jib, [reachMax + 1, 0.12, 0.12], [(reachMax + 1) / 2, 0.8, 0], color);
  for (let x = 0; x < reachMax; x += 1.6) {
    beam(jib, [x, 0, 0], [Math.min(x + 1.6, reachMax), 0.8, 0], 0.08, color);
  }

  // Counter-Jib (extends backward along -X)
  const counterLen = 4.8;
  box(jib, [counterLen, 0.22, 0.7], [-counterLen / 2, 0, 0], color);
  box(jib, [1.6, 1.2, 1.4], [-counterLen + 0.8, 0.6, 0], '#686a66'); // Concrete weights

  // 3. Trolley (moves along jib X)
  const trolley = new T.Group();
  box(trolley, [0.9, 0.35, 0.85], [0, -0.22, 0], trimColor);
  // Wheels
  for (const tz of [-0.38, 0.38]) {
    for (const tx of [-0.3, 0.3]) {
      taper(trolley, 0.1, 0.1, 0.1, [tx, -0.05, tz], '#777777');
    }
  }
  jib.add(trolley);
  root.userData.trolley = trolley;

  // 4. Hook & Grabber Assembly (positioned in world coordinates)
  const hook = new T.Group();
  box(hook, [0.55, 0.25, 0.55], [0, 0.1, 0], trimColor);
  // Pulley block
  taper(hook, 0.22, 0.22, 0.15, [0, 0.25, 0], color);
  // Grabber tongs / magnet
  box(hook, [0.7, 0.12, 0.7], [0, -0.1, 0], color);
  for (const hx of [-0.3, 0.3]) {
    beam(hook, [hx, -0.1, 0], [hx * 0.7, -0.45, 0], 0.08, trimColor);
  }
  root.add(hook);
  root.userData.hook = hook;

  // 5. Solid 3D Steel Cable from trolley to hook
  const cableGeom = new T.CylinderGeometry(0.035, 0.035, 1, 8);
  const cableMat = new T.MeshStandardMaterial({
    color: '#222222',
    roughness: 0.55,
    metalness: 0.8,
  });
  const cable = new T.Mesh(cableGeom, cableMat);
  cable.castShadow = true;
  root.add(cable);
  root.userData.cable = cable;

  batchScenery(jib, [trolley]);
  batchScenery(trolley);
  batchScenery(hook);
  batchScenery(root, [jib, hook, cable]);
  return root;
}

export function createCrateMesh(kind: CrateKind) {
  const g = new T.Group();
  g.name = `crate-model-${kind}`;
  const cfg = CRATE_CONFIGS[kind];
  const { w, h, d, color } = cfg;

  if (kind === 'crate') {
    // Wooden crate with corner brackets and crossbands
    box(g, [w, h, d], [0, 0, 0], color);
    // Darker wooden trim bands
    box(g, [w + 0.04, 0.14, d + 0.04], [0, h / 2 - 0.12, 0], '#8a6538');
    box(g, [w + 0.04, 0.14, d + 0.04], [0, -h / 2 + 0.12, 0], '#8a6538');
    // Metal corner rivets
    for (const cx of [-w / 2, w / 2]) {
      for (const cz of [-d / 2, d / 2]) {
        box(g, [0.1, h + 0.02, 0.1], [cx, 0, cz], '#4d4740');
      }
    }
  } else if (kind === 'block') {
    // Concrete block
    box(g, [w, h, d], [0, 0, 0], color, true);
    // Bevel indentation line
    box(g, [w + 0.02, 0.08, d - 0.2], [0, 0, 0], '#7e837c');
  } else if (kind === 'beam') {
    // Steel I-Beam
    const flangeH = 0.1;
    box(g, [w, flangeH, d], [0, h / 2 - flangeH / 2, 0], color);
    box(g, [w, flangeH, d], [0, -h / 2 + flangeH / 2, 0], color);
    box(g, [w, h - flangeH * 2, 0.16], [0, 0, 0], '#9e4624');
  } else if (kind === 'barrel') {
    // Metal drum
    taper(g, w / 2, w / 2, h, [0, 0, 0], color, 14);
    // Reinforcement rings
    taper(g, w / 2 + 0.04, w / 2 + 0.04, 0.08, [0, h / 4, 0], '#24484f', 14);
    taper(g, w / 2 + 0.04, w / 2 + 0.04, 0.08, [0, -h / 4, 0], '#24484f', 14);
  } else if (kind === 'golden') {
    // Golden reward crate
    box(g, [w, h, d], [0, 0, 0], color, true);
    // Sparkling gold trim
    box(g, [w + 0.04, 0.15, d + 0.04], [0, 0, 0], '#ffea75');
    box(g, [0.15, h + 0.04, d + 0.04], [0, 0, 0], '#ffea75');
  }

  batchScenery(g);
  return g;
}

export function createPlatformMesh(team: TeamId) {
  const g = new T.Group();
  g.name = `platform-${team}`;
  const cfg = CRANE_CONFIG[team];
  g.position.set(cfg.pad.x, 0, cfg.pad.z);

  // Raised foundation base
  box(g, [PAD_SIZE, PAD_Y, PAD_SIZE], [0, PAD_Y / 2, 0], '#3a3834');
  // Center decking plank
  box(
    g,
    [PAD_SIZE - 0.6, 0.04, PAD_SIZE - 0.6],
    [0, PAD_Y + 0.02, 0],
    cfg.color,
  );

  // Hazard border safety chevrons
  const half = PAD_SIZE / 2;
  box(g, [PAD_SIZE, 0.06, 0.25], [0, PAD_Y + 0.03, half - 0.15], '#f2be3f');
  box(g, [PAD_SIZE, 0.06, 0.25], [0, PAD_Y + 0.03, -half + 0.15], '#f2be3f');
  box(g, [0.25, 0.06, PAD_SIZE], [half - 0.15, PAD_Y + 0.03, 0], '#f2be3f');
  box(g, [0.25, 0.06, PAD_SIZE], [-half + 0.15, PAD_Y + 0.03, 0], '#f2be3f');

  // Corner measurement poles (height markers)
  for (const cx of [-half, half]) {
    for (const cz of [-half, half]) {
      box(g, [0.15, 14, 0.15], [cx, 7, cz], '#57544e');
      // Glow tips
      ball(g, [0.2, 0.2, 0.2], [cx, 14.1, cz], cfg.color);
    }
  }

  batchScenery(g);
  return g;
}

export function createLaserLine(team: TeamId) {
  const cfg = CRANE_CONFIG[team];
  const g = new T.Group();
  g.name = `laser-${team}`;
  g.position.set(cfg.pad.x, PAD_Y, cfg.pad.z);

  // A lighter tint of the team colour, so the laser glows above the decking.
  const laserColor = new T.Color(cfg.color).offsetHSL(0, 0, 0.15);
  const laserMat = new T.MeshBasicMaterial({
    color: laserColor,
    wireframe: true,
  });

  // Glowing perimeter box showing target stack height
  const geom = new T.BoxGeometry(PAD_SIZE - 0.2, 0.08, PAD_SIZE - 0.2);
  const mesh = new T.Mesh(geom, laserMat);
  g.add(mesh);

  batchScenery(g);
  return g;
}
