import * as T from 'three';
import { worker, type WorkerOutfit } from '../../shared/rendering/worker';
import type { Look } from '../../shared/wardrobe/look';
import { dressWorker } from '../../shared/rendering/cosmetics/dress';
import { ZORB_RADIUS, type TeamId } from './types';

export type ZorbMeshRig = {
  root: T.Group;
  bubble: T.Mesh;
  workerGroup: T.Group;
  innerRig: Record<'body' | 'legL' | 'legR' | 'armL' | 'armR', T.Group>;
  overheadIndicator?: T.Group;
  shadow?: T.Mesh;
  squash: number;
};

const TEAM_COLORS: Record<
  TeamId,
  { primary: string; secondary: string; bubble: number; glow: string }
> = {
  red: {
    primary: '#f95738',
    secondary: '#ee964b',
    bubble: 0xff6b4a,
    glow: '#8b1e0f',
  },
  blue: {
    primary: '#00b4d8',
    secondary: '#90e0ef',
    bubble: 0x38bdf8,
    glow: '#0353a4',
  },
};

/** Builds an overhead floating name badge texture. */
function createNameBadgeTexture(
  name: string,
  teamColor: string,
): T.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  // Translucent dark rounded pill background
  ctx.fillStyle = 'rgba(18, 22, 34, 0.85)';
  ctx.beginPath();
  ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 26);
  ctx.fill();

  // Team-colored border
  ctx.strokeStyle = teamColor;
  ctx.lineWidth = 5;
  ctx.stroke();

  // White crisp text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, canvas.width / 2, canvas.height / 2);

  const tex = new T.CanvasTexture(canvas);
  return tex;
}

/** Builds an inflatable transparent Zorb sphere containing the collection worker. */
export function createZorbAvatar(
  team: TeamId,
  colorIndex: number,
  look?: Look,
  name?: string,
  isLocal = false,
): ZorbMeshRig {
  const root = new T.Group();

  // 1. Inflatable Outer Bubble Sphere with high-gloss vinyl sheen
  const bubbleGeo = new T.SphereGeometry(ZORB_RADIUS, 28, 24);
  const bubbleMat = new T.MeshPhysicalMaterial({
    color: TEAM_COLORS[team].bubble,
    transmission: 0.86,
    opacity: 0.72,
    transparent: true,
    roughness: 0.08,
    metalness: 0.06,
    ior: 1.42,
    reflectivity: 0.75,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    depthWrite: false,
  });
  const bubble = new T.Mesh(bubbleGeo, bubbleMat);
  bubble.castShadow = true;
  root.add(bubble);

  // 2. Colored Bumper Ribs / Inflatable Seams with subtle team glow
  const ribMat = new T.MeshStandardMaterial({
    color: TEAM_COLORS[team].primary,
    emissive: TEAM_COLORS[team].glow,
    emissiveIntensity: 0.25,
    roughness: 0.2,
    metalness: 0.15,
    transparent: true,
    opacity: 0.9,
  });

  // Equator Rib
  const equatorGeo = new T.TorusGeometry(ZORB_RADIUS * 0.99, 0.05, 8, 32);
  const equator = new T.Mesh(equatorGeo, ribMat);
  equator.rotation.x = Math.PI / 2;
  root.add(equator);

  // Vertical Ribs (4 hoops)
  for (let i = 0; i < 4; i++) {
    const vRibGeo = new T.TorusGeometry(ZORB_RADIUS * 0.99, 0.04, 8, 32);
    const vRib = new T.Mesh(vRibGeo, ribMat);
    vRib.rotation.y = (i * Math.PI) / 4;
    root.add(vRib);
  }

  // 3. Interior Safety Harness Handlebars
  const handleMat = new T.MeshStandardMaterial({
    color: '#2b2d42',
    roughness: 0.5,
    metalness: 0.2,
  });
  const handleGeo = new T.CylinderGeometry(0.04, 0.04, 0.8, 8);
  const handleBar = new T.Mesh(handleGeo, handleMat);
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0, 0.05, 0.22);
  root.add(handleBar);

  // 4. Interior Collection Worker Avatar
  const outfit: WorkerOutfit = {
    shirt: TEAM_COLORS[team].primary,
    overalls: team === 'red' ? '#8b1e0f' : '#0353a4',
    boots: '#2b2d42',
    cap: true,
  };

  const workerModel = worker(colorIndex, outfit);
  if (look) {
    dressWorker(workerModel, outfit.shirt ?? '#f95738', look);
  }

  // Add safety harness chest straps to worker
  const strapMat = new T.MeshStandardMaterial({
    color: '#1e2430',
    roughness: 0.7,
  });
  const strapGeoL = new T.BoxGeometry(0.08, 0.48, 0.06);
  const strapL = new T.Mesh(strapGeoL, strapMat);
  strapL.position.set(-0.16, 0.92, 0.23);
  workerModel.add(strapL);

  const strapR = new T.Mesh(strapGeoL, strapMat);
  strapR.position.set(0.16, 0.92, 0.23);
  workerModel.add(strapR);

  // Center worker inside workerGroup around center of mass (y = 0.96, z = 0.03)
  workerModel.position.set(0, -0.96, -0.03);

  // Scale and center worker snugly inside the Zorb sphere
  const workerGroup = new T.Group();
  workerGroup.scale.setScalar(0.72);
  workerGroup.position.set(0, -0.08, 0);
  workerGroup.add(workerModel);
  root.add(workerGroup);

  const innerRig = workerModel.userData as Record<
    'body' | 'legL' | 'legR' | 'armL' | 'armR',
    T.Group
  >;

  // 5. Soft Ground Contact Shadow (moves with root, projected at ground plane)
  const shadowGeo = new T.CircleGeometry(0.95, 20);
  const shadowMat = new T.MeshBasicMaterial({
    color: '#000000',
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const shadow = new T.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -ZORB_RADIUS + 0.02;
  root.add(shadow);

  // 6. Overhead Floating Indicator / Name Badge
  let overheadIndicator: T.Group | undefined;
  if (name || isLocal) {
    overheadIndicator = new T.Group();
    overheadIndicator.position.y = 1.7;

    // Floating Name Pill Badge
    const badgeGeo = new T.PlaneGeometry(1.4, 0.35);
    const badgeMat = new T.MeshBasicMaterial({
      map: createNameBadgeTexture(
        name || (isLocal ? 'YOU' : 'Player'),
        TEAM_COLORS[team].primary,
      ),
      transparent: true,
      side: T.DoubleSide,
      depthTest: false,
    });
    const badgeMesh = new T.Mesh(badgeGeo, badgeMat);
    badgeMesh.renderOrder = 999;
    overheadIndicator.add(badgeMesh);

    // If local player, add glowing golden chevron arrow hovering above the badge
    if (isLocal) {
      const arrowGeo = new T.ConeGeometry(0.22, 0.35, 4);
      const arrowMat = new T.MeshStandardMaterial({
        color: '#ffd166',
        emissive: '#ffbe0b',
        emissiveIntensity: 0.5,
        roughness: 0.2,
      });
      const arrow = new T.Mesh(arrowGeo, arrowMat);
      arrow.rotation.x = Math.PI; // Pointing down towards player
      arrow.position.set(0, 0.42, 0);
      overheadIndicator.add(arrow);
    }

    root.add(overheadIndicator);
  }

  return {
    root,
    bubble,
    workerGroup,
    innerRig,
    overheadIndicator,
    shadow,
    squash: 0,
  };
}

/** Animates worker inside the Zorb depending on rolling, charging, bracing, or turtle state. */
export function poseZorbWorker(
  rig: ZorbMeshRig,
  time: number,
  state: {
    speed: number;
    turtle: boolean;
    braced: boolean;
    dashCharge: number;
    dashing: boolean;
  },
) {
  const { innerRig, workerGroup, bubble, overheadIndicator } = rig;

  // 1. Elastic Squash & Stretch response
  rig.squash = Math.max(0, rig.squash - 0.04);
  const sq = rig.squash;

  if (state.dashCharge > 0.05) {
    // Charging vibration pulse
    const pulse = 1.0 + Math.sin(time * 26) * 0.07 * state.dashCharge;
    bubble.scale.set(
      pulse + sq * 0.1,
      1 - (pulse - 1) * 0.8 - sq * 0.15,
      pulse + sq * 0.1,
    );
  } else if (state.dashing) {
    // Torpedo speed burst shape
    bubble.scale.set(0.92, 0.92, 1.14);
  } else if (sq > 0.01) {
    // Post-impact squash
    bubble.scale.set(1 + sq * 0.18, 1 - sq * 0.22, 1 + sq * 0.18);
  } else {
    bubble.scale.set(1, 1, 1);
  }

  // 2. Overhead Indicator Bobbing
  if (overheadIndicator) {
    overheadIndicator.position.y = 1.7 + Math.sin(time * 4) * 0.06;
  }

  // 3. Worker Poses
  if (state.turtle) {
    // Hilarious Upside-Down Turtle State: workerGroup pivots upside-down around center of mass
    workerGroup.position.y = 0.05;
    workerGroup.rotation.x = Math.PI + Math.sin(time * 8) * 0.15;
    workerGroup.rotation.z = Math.cos(time * 7) * 0.2;
    innerRig.body.rotation.set(0, 0, 0);

    // Chaotic flailing legs strictly within the bubble boundary
    const kickL = Math.sin(time * 19) * 0.65 + 0.2;
    const kickR = Math.sin(time * 21 + 1.2) * 0.65 - 0.2;
    innerRig.legL.rotation.set(kickL, 0, Math.sin(time * 14) * 0.25);
    innerRig.legR.rotation.set(kickR, 0, -Math.sin(time * 15) * 0.25);

    // Arms waving frantically for help
    innerRig.armL.rotation.set(
      -1.8 + Math.sin(time * 16) * 0.35,
      0,
      -0.3 + Math.cos(time * 18) * 0.25,
    );
    innerRig.armR.rotation.set(
      -1.8 + Math.cos(time * 17) * 0.35,
      0,
      0.3 - Math.sin(time * 18) * 0.25,
    );
  } else if (state.braced) {
    // Sumo Anchor Stance: Low squat, gripping handles firmly
    workerGroup.rotation.set(0, 0, 0);
    workerGroup.position.y = -0.16;
    innerRig.body.rotation.set(0.12, 0, 0);

    innerRig.legL.rotation.set(0.35, 0, -0.25);
    innerRig.legR.rotation.set(0.35, 0, 0.25);

    innerRig.armL.rotation.set(-1.4, 0.2, -0.2);
    innerRig.armR.rotation.set(-1.4, -0.2, 0.2);
  } else if (state.dashCharge > 0) {
    // Charging tuck: Leaning forward like a sprinter in the blocks
    workerGroup.rotation.set(0, 0, 0);
    const lean = 0.12 + state.dashCharge * 0.25;
    workerGroup.position.y = -0.08 - state.dashCharge * 0.05;
    innerRig.body.rotation.set(
      lean,
      0,
      (Math.random() - 0.5) * 0.03 * state.dashCharge,
    );

    innerRig.legL.rotation.set(-0.25 * state.dashCharge, 0, 0);
    innerRig.legR.rotation.set(0.35 * state.dashCharge, 0, 0);

    innerRig.armL.rotation.set(-1.6, 0, -0.1);
    innerRig.armR.rotation.set(-1.6, 0, 0.1);
  } else {
    // Normal rolling / sprinting inside the sphere
    workerGroup.rotation.set(0, 0, 0);
    workerGroup.position.y = -0.08;
    innerRig.body.rotation.set(0, 0, 0);

    const isMoving = state.speed > 0.5;
    const runFreq = Math.min(18, state.speed * 2.8);
    const swing = isMoving ? Math.sin(time * runFreq) * 0.6 : 0;

    innerRig.legL.rotation.set(swing, 0, 0);
    innerRig.legR.rotation.set(-swing, 0, 0);

    // Holding onto handles with subtle movement
    innerRig.armL.rotation.set(-1.4 + swing * 0.15, 0, 0);
    innerRig.armR.rotation.set(-1.4 - swing * 0.15, 0, 0);
  }
}
