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
  handleBar.position.set(0, 0.15, 0.25);
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

  // Scale and center worker snugly inside the Zorb sphere
  const workerGroup = new T.Group();
  workerGroup.scale.setScalar(0.9);
  workerGroup.position.set(0, -0.75, 0);
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
    // Hilarious Upside-Down Turtle State: legs kick frantically in the air!
    workerGroup.position.y = -0.4;
    innerRig.body.rotation.x = Math.PI + Math.sin(time * 8) * 0.15;
    innerRig.body.rotation.z = Math.cos(time * 7) * 0.2;

    // High frequency chaotic flailing
    const kickL = Math.sin(time * 19) * 1.3 + 0.3;
    const kickR = Math.sin(time * 21 + 1.2) * 1.3 - 0.3;
    innerRig.legL.rotation.x = kickL;
    innerRig.legL.rotation.z = Math.sin(time * 14) * 0.4;
    innerRig.legR.rotation.x = kickR;
    innerRig.legR.rotation.z = -Math.sin(time * 15) * 0.4;

    // Arms waving frantically for help
    innerRig.armL.rotation.x = -2.2 + Math.sin(time * 16) * 0.8;
    innerRig.armL.rotation.z = -0.5 + Math.cos(time * 18) * 0.5;
    innerRig.armR.rotation.x = -2.2 + Math.cos(time * 17) * 0.8;
    innerRig.armR.rotation.z = 0.5 - Math.sin(time * 18) * 0.5;
  } else if (state.braced) {
    // Sumo Anchor Stance: Low squat, gripping handles firmly
    workerGroup.position.y = -0.85;
    innerRig.body.rotation.set(0.15, 0, 0);

    innerRig.legL.rotation.set(0.4, 0, -0.35);
    innerRig.legR.rotation.set(0.4, 0, 0.35);

    innerRig.armL.rotation.set(-1.4, 0.3, -0.2);
    innerRig.armR.rotation.set(-1.4, -0.3, 0.2);
  } else if (state.dashCharge > 0) {
    // Charging tuck: Leaning forward like a sprinter in the blocks
    const lean = 0.2 + state.dashCharge * 0.4;
    workerGroup.position.y = -0.75 - state.dashCharge * 0.08;
    innerRig.body.rotation.set(
      lean,
      0,
      (Math.random() - 0.5) * 0.05 * state.dashCharge,
    );

    innerRig.legL.rotation.set(-0.3 * state.dashCharge, 0, 0);
    innerRig.legR.rotation.set(0.5 * state.dashCharge, 0, 0);

    innerRig.armL.rotation.set(-1.8, 0, -0.1);
    innerRig.armR.rotation.set(-1.8, 0, 0.1);
  } else {
    // Normal rolling / sprinting inside the sphere
    workerGroup.position.y = -0.75;
    innerRig.body.rotation.set(0, 0, 0);

    const isMoving = state.speed > 0.5;
    const runFreq = Math.min(18, state.speed * 2.8);
    const swing = isMoving ? Math.sin(time * runFreq) * 0.8 : 0;

    innerRig.legL.rotation.set(swing, 0, 0);
    innerRig.legR.rotation.set(-swing, 0, 0);

    // Holding onto handles with subtle movement
    innerRig.armL.rotation.set(-1.5 + swing * 0.2, 0, 0);
    innerRig.armR.rotation.set(-1.5 - swing * 0.2, 0, 0);
  }
}
