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
};

const TEAM_COLORS: Record<
  TeamId,
  { primary: string; secondary: string; bubble: number }
> = {
  red: { primary: '#f95738', secondary: '#ee964b', bubble: 0xff6b4a },
  blue: { primary: '#00b4d8', secondary: '#90e0ef', bubble: 0x38bdf8 },
};

/** Builds an inflatable transparent Zorb sphere containing the collection worker. */
export function createZorbAvatar(
  team: TeamId,
  colorIndex: number,
  look?: Look,
): ZorbMeshRig {
  const root = new T.Group();

  // Inflatable Outer Bubble Sphere
  const bubbleGeo = new T.SphereGeometry(ZORB_RADIUS, 24, 24);
  const bubbleMat = new T.MeshPhysicalMaterial({
    color: TEAM_COLORS[team].bubble,
    transmission: 0.85,
    opacity: 0.7,
    transparent: true,
    roughness: 0.15,
    metalness: 0.05,
    ior: 1.33,
    reflectivity: 0.6,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    depthWrite: false,
  });
  const bubble = new T.Mesh(bubbleGeo, bubbleMat);
  bubble.castShadow = true;
  root.add(bubble);

  // Colored Bumper Ribs / Inflatable Seams
  const ribMat = new T.MeshStandardMaterial({
    color: TEAM_COLORS[team].primary,
    roughness: 0.3,
    metalness: 0.2,
    transparent: true,
    opacity: 0.85,
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

  // Interior Safety Harness Handlebars
  const handleMat = new T.MeshStandardMaterial({
    color: '#2b2d42',
    roughness: 0.6,
  });
  const handleGeo = new T.CylinderGeometry(0.04, 0.04, 0.8, 8);
  const handleBar = new T.Mesh(handleGeo, handleMat);
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0, 0.05, 0.22);
  root.add(handleBar);

  // Interior Collection Worker Avatar
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

  return { root, bubble, workerGroup, innerRig };
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
  const { innerRig, workerGroup } = rig;

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
