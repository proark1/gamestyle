import * as T from 'three';
import { box, material } from '../../shared/rendering/primitives';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { WORKER_HEAD_TOP } from '../../shared/rendering/worker';
import type { Look } from '../../shared/wardrobe/look';
import { BALL_RADIUS, COURT, type TeamId } from './types';

/**
 * Creates a tennis doubles player using the shared worker avatar.
 * Dressed in team-colored polo shirt, athletic shorts and tennis sneakers.
 */
export function tennisPlayer(color: string, team: TeamId, look?: Look) {
  const shortsColor = '#ffffff';
  const shirtColor = color;
  const shoesColor = team === 'orange' ? '#ff9045' : '#45b5aa';

  const { model: g, worn } = dressedWorker(
    0,
    {
      shirt: shirtColor,
      overalls: shortsColor,
      boots: shoesColor,
      cap: false,
    },
    look,
  );

  const body = g.userData.body as T.Group;

  // Sun visor / athletic sweatband if player is not wearing a wardrobe hat
  if (!worn.hat) {
    // Hair base
    box(
      body,
      [0.54, 0.12, 0.52],
      [0, WORKER_HEAD_TOP + 0.03, 0],
      '#36281e',
      true,
    );
    // Sweatband around forehead
    box(
      body,
      [0.55, 0.08, 0.53],
      [0, WORKER_HEAD_TOP - 0.04, 0],
      team === 'orange' ? '#ffa266' : '#69d2c6',
    );
    // Visor brim extending forward
    box(body, [0.48, 0.03, 0.22], [0, WORKER_HEAD_TOP - 0.02, 0.32], '#ffffff');
  }

  // Polo shirt collar and button placket
  box(body, [0.26, 0.18, 0.03], [0, 1.05, 0.22], '#ffffff');
  box(body, [0.06, 0.14, 0.04], [0, 0.95, 0.22], '#ffffff');

  // Tennis racket attached to player root
  const racket = createTennisRacket(team);
  racket.name = 'tennis-racket';
  g.add(racket);
  g.userData.racket = racket;

  return g;
}

/** Creates a stylized low-poly perforated padel bat (pala) */
export function createTennisRacket(team: TeamId): T.Group {
  const g = new T.Group();

  const accentColor = team === 'orange' ? '#ff7700' : '#00b4d8';
  const accentMat = material(accentColor);
  const carbonMat = material('#202226');
  const gripMat = material('#ffffff');
  const holeMat = material('#111317');

  // Handle / Grip
  const grip = new T.Mesh(
    new T.CylinderGeometry(0.034, 0.038, 0.32, 8),
    gripMat,
  );
  grip.position.set(0, 0.16, 0);
  grip.castShadow = true;
  g.add(grip);

  // Safety wrist lanyard cord at bottom of handle
  const cord = new T.Mesh(
    new T.TorusGeometry(0.035, 0.007, 6, 16),
    accentMat,
  );
  cord.position.set(0, 0.01, 0);
  cord.rotation.x = Math.PI / 2;
  g.add(cord);

  // Bat Throat / Heart
  const throat = new T.Mesh(
    new T.BoxGeometry(0.1, 0.12, 0.05),
    carbonMat,
  );
  throat.position.set(0, 0.36, 0);
  throat.castShadow = true;
  g.add(throat);

  // Solid Composite Bat Face (Diamond / Round shape)
  const faceMesh = new T.Mesh(
    new T.CylinderGeometry(0.22, 0.22, 0.06, 16),
    carbonMat,
  );
  faceMesh.position.set(0, 0.60, 0);
  faceMesh.rotation.x = Math.PI / 2;
  faceMesh.scale.set(1.0, 0.7, 1.2);
  faceMesh.castShadow = true;
  g.add(faceMesh);

  // Outer edge protector rim (team colored)
  const rimMesh = new T.Mesh(
    new T.TorusGeometry(0.22, 0.018, 8, 24),
    accentMat,
  );
  rimMesh.position.set(0, 0.60, 0);
  rimMesh.scale.set(1.0, 1.2, 0.7);
  rimMesh.castShadow = true;
  g.add(rimMesh);

  // Signature Padel perforations / drill holes pattern on face
  const holePositions: [number, number][] = [
    [-0.08, 0.54], [0, 0.54], [0.08, 0.54],
    [-0.10, 0.60], [-0.04, 0.60], [0.04, 0.60], [0.10, 0.60],
    [-0.10, 0.65], [-0.04, 0.65], [0.04, 0.65], [0.10, 0.65],
    [-0.07, 0.70], [0, 0.70], [0.07, 0.70],
  ];

  for (const [hx, hy] of holePositions) {
    const dot1 = new T.Mesh(new T.CircleGeometry(0.014, 8), holeMat);
    dot1.position.set(hx, hy, 0.032);
    g.add(dot1);
    const dot2 = new T.Mesh(new T.CircleGeometry(0.014, 8), holeMat);
    dot2.position.set(hx, hy, -0.032);
    dot2.rotation.y = Math.PI;
    g.add(dot2);
  }

  return g;
}

export const createPadelBat = createTennisRacket;

/** Creates the tennis ball with bright felt and curved seams */
export function tennisBall(): T.Group {
  const g = new T.Group();

  const sphereGeo = new T.SphereGeometry(BALL_RADIUS, 16, 12);
  const ballMat = material('#ccff00'); // Vibrant tennis felt yellow
  const sphere = new T.Mesh(sphereGeo, ballMat);
  sphere.castShadow = true;
  g.add(sphere);

  // Curved white seams
  const seamMat = material('#ffffff');
  const seam1 = new T.Mesh(
    new T.TorusGeometry(BALL_RADIUS + 0.001, 0.012, 6, 24),
    seamMat,
  );
  seam1.rotation.x = Math.PI / 4;
  g.add(seam1);

  const seam2 = new T.Mesh(
    new T.TorusGeometry(BALL_RADIUS + 0.001, 0.012, 6, 24),
    seamMat,
  );
  seam2.rotation.x = -Math.PI / 4;
  g.add(seam2);

  return g;
}

/** Creates the complete 3D tennis court scene with net and surroundings */
export function tennisCourt(): T.Group {
  const g = new T.Group();

  // Court floor dimensions
  const outerWidth = COURT.width + 5;
  const outerLength = COURT.length + 6;

  // Outer surround (navy / dark blue)
  const outerMat = material('#1d4e74');
  const outerGeo = new T.PlaneGeometry(outerWidth, outerLength);
  const outerMesh = new T.Mesh(outerGeo, outerMat);
  outerMesh.rotation.x = -Math.PI / 2;
  outerMesh.receiveShadow = true;
  g.add(outerMesh);

  // Playing court surface (bright royal court blue)
  const courtMat = material('#2a6fa8');
  const courtGeo = new T.PlaneGeometry(COURT.width, COURT.length);
  const courtMesh = new T.Mesh(courtGeo, courtMat);
  courtMesh.position.y = 0.005;
  courtMesh.rotation.x = -Math.PI / 2;
  courtMesh.receiveShadow = true;
  g.add(courtMesh);

  // Line helper
  const lineMat = material('#ffffff');
  const addLine = (w: number, l: number, x: number, z: number) => {
    const mesh = new T.Mesh(new T.PlaneGeometry(w, l), lineMat);
    mesh.position.set(x, 0.01, z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    g.add(mesh);
  };

  const lw = 0.1; // Line width

  // Baselines
  addLine(COURT.width, lw, 0, -COURT.length / 2);
  addLine(COURT.width, lw, 0, COURT.length / 2);

  // Sidelines (outer doubles)
  addLine(lw, COURT.length, -COURT.width / 2, 0);
  addLine(lw, COURT.length, COURT.width / 2, 0);

  // Singles sidelines (1.1m in from outer edge)
  const singlesOffset = COURT.width / 2 - 1.1;
  addLine(lw, COURT.length, -singlesOffset, 0);
  addLine(lw, COURT.length, singlesOffset, 0);

  // Service lines (at z = -5.5 and z = 5.5)
  const serviceWidth = singlesOffset * 2;
  addLine(serviceWidth, lw, 0, -COURT.serviceLineZ);
  addLine(serviceWidth, lw, 0, COURT.serviceLineZ);

  // Center service line (between service line and net)
  addLine(lw, COURT.serviceLineZ * 2, 0, 0);

  // Center marks at baselines
  addLine(lw, 0.4, 0, -COURT.length / 2 + 0.2);
  addLine(lw, 0.4, 0, COURT.length / 2 - 0.2);

  // --- Tennis Net ---
  const netPostMat = material('#333333');
  const postRadius = 0.08;
  const postHeight = COURT.netHeight + 0.1;
  const postOffset = COURT.width / 2 + 0.5;

  // Left & Right posts
  for (const x of [-postOffset, postOffset]) {
    const post = new T.Mesh(
      new T.CylinderGeometry(postRadius, postRadius, postHeight, 12),
      netPostMat,
    );
    post.position.set(x, postHeight / 2, 0);
    post.castShadow = true;
    g.add(post);
  }

  // Net top cable / white headband
  const cableMesh = new T.Mesh(
    new T.BoxGeometry(postOffset * 2, 0.06, 0.04),
    material('#ffffff'),
  );
  cableMesh.position.set(0, COURT.netHeight, 0);
  cableMesh.castShadow = true;
  g.add(cableMesh);

  // Net mesh grid
  const netGeo = new T.PlaneGeometry(postOffset * 2, COURT.netHeight);
  const netMat = new T.MeshStandardMaterial({
    color: '#1a1a1a',
    transparent: true,
    opacity: 0.55,
    side: T.DoubleSide,
    roughness: 0.9,
  });
  const netMesh = new T.Mesh(netGeo, netMat);
  netMesh.position.set(0, COURT.netHeight / 2, 0);
  g.add(netMesh);

  // Center white strap
  const strap = new T.Mesh(
    new T.BoxGeometry(0.12, COURT.netHeight, 0.05),
    material('#ffffff'),
  );
  strap.position.set(0, COURT.netHeight / 2, 0);
  g.add(strap);

  // Umpire chair on the side
  const chairGroup = new T.Group();
  chairGroup.position.set(-postOffset - 1.4, 0, 0);
  // Legs
  box(chairGroup, [0.08, 2.2, 0.08], [-0.3, 1.1, -0.3], '#2e4057');
  box(chairGroup, [0.08, 2.2, 0.08], [0.3, 1.1, -0.3], '#2e4057');
  box(chairGroup, [0.08, 2.2, 0.08], [-0.3, 1.1, 0.3], '#2e4057');
  box(chairGroup, [0.08, 2.2, 0.08], [0.3, 1.1, 0.3], '#2e4057');
  // Seat
  box(chairGroup, [0.7, 0.1, 0.7], [0, 1.8, 0], '#e67e22');
  box(chairGroup, [0.7, 0.6, 0.08], [0, 2.15, -0.32], '#e67e22');
  g.add(chairGroup);

  // --- Padel Court Enclosure (3.8m Glass Back Walls & Wire Mesh Sides) ---
  const glassMat = new T.MeshStandardMaterial({
    color: '#bde0fe',
    transparent: true,
    opacity: 0.32,
    roughness: 0.05,
    metalness: 0.2,
    side: T.DoubleSide,
  });

  const meshMat = new T.MeshStandardMaterial({
    color: '#283845',
    transparent: true,
    opacity: 0.6,
    roughness: 0.8,
    side: T.DoubleSide,
  });

  const postColor = '#1e293b'; // Charcoal structural steel
  const wallH = COURT.wallHeight; // 3.8m
  const halfW = COURT.width / 2; // 6.5m
  const halfL = COURT.length / 2; // 11.0m

  // --- Back Glass Walls (North & South) ---
  for (const z of [-halfL, halfL]) {
    // Panoramic Glass Panel
    const backGlassGeo = new T.PlaneGeometry(COURT.width, wallH);
    const backGlassMesh = new T.Mesh(backGlassGeo, glassMat);
    backGlassMesh.position.set(0, wallH / 2, z);
    g.add(backGlassMesh);

    // Top horizontal steel beam
    box(g, [COURT.width + 0.16, 0.08, 0.08], [0, wallH, z], postColor);
    // Bottom kickplate trim
    box(g, [COURT.width, 0.12, 0.06], [0, 0.06, z], postColor);

    // Vertical structural posts every 2.6m
    for (const x of [-halfW, -3.9, -1.3, 1.3, 3.9, halfW]) {
      box(g, [0.08, wallH, 0.08], [x, wallH / 2, z], postColor);
    }
  }

  // --- Side Walls (Glass corners + Wire mesh center) ---
  for (const x of [-halfW, halfW]) {
    // North corner glass (z from -11 to -7)
    const cornerGlassNorth = new T.Mesh(
      new T.PlaneGeometry(4.0, wallH),
      glassMat,
    );
    cornerGlassNorth.position.set(x, wallH / 2, -9.0);
    cornerGlassNorth.rotation.y = Math.PI / 2;
    g.add(cornerGlassNorth);

    // South corner glass (z from +7 to +11)
    const cornerGlassSouth = new T.Mesh(
      new T.PlaneGeometry(4.0, wallH),
      glassMat,
    );
    cornerGlassSouth.position.set(x, wallH / 2, 9.0);
    cornerGlassSouth.rotation.y = Math.PI / 2;
    g.add(cornerGlassSouth);

    // Center wire mesh (z from -7 to +7, height 3.0m)
    const centerMesh = new T.Mesh(
      new T.PlaneGeometry(14.0, 3.0),
      meshMat,
    );
    centerMesh.position.set(x, 1.5, 0);
    centerMesh.rotation.y = Math.PI / 2;
    g.add(centerMesh);

    // Top beam connecting entire side wall
    box(g, [0.08, 0.08, COURT.length], [x, wallH, 0], postColor);
    // Bottom kickplate trim
    box(g, [0.06, 0.12, COURT.length], [x, 0.06, 0], postColor);

    // Vertical side posts
    for (const z of [-halfL, -7.0, -3.5, 0, 3.5, 7.0, halfL]) {
      box(g, [0.08, wallH, 0.08], [x, wallH / 2, z], postColor);
    }
  }

  // --- 4 Padel Court LED Floodlight Towers ---
  const floodLightPos: [number, number][] = [
    [-halfW - 0.5, -5.5],
    [halfW + 0.5, -5.5],
    [-halfW - 0.5, 5.5],
    [halfW + 0.5, 5.5],
  ];

  for (const [fx, fz] of floodLightPos) {
    const lightMast = new T.Group();
    lightMast.position.set(fx, 0, fz);

    // Main steel column (5.2m tall)
    box(lightMast, [0.12, 5.2, 0.12], [0, 2.6, 0], '#1e293b');

    // Angled cantilever arm pointing inward
    const dirX = fx < 0 ? 0.35 : -0.35;
    box(lightMast, [0.7, 0.08, 0.08], [dirX, 5.2, 0], '#1e293b');

    // LED lamp head
    const lampHead = new T.Mesh(
      new T.BoxGeometry(0.5, 0.12, 0.35),
      material('#2c3e50'),
    );
    lampHead.position.set(dirX * 1.5, 5.15, 0);
    lampHead.rotation.z = fx < 0 ? -0.35 : 0.35;
    lightMast.add(lampHead);

    // Glowing LED emitter plane
    const ledPlane = new T.Mesh(
      new T.PlaneGeometry(0.42, 0.28),
      new T.MeshBasicMaterial({ color: '#f8fafc' }),
    );
    ledPlane.position.set(dirX * 1.5, 5.08, 0);
    ledPlane.rotation.x = Math.PI / 2;
    lightMast.add(ledPlane);

    g.add(lightMast);
  }

  return g;
}

/** Dynamic Bungee Cord 3D Mesh connecting two players */
export function createBungeeCord(team: TeamId): {
  group: T.Group;
  update: (
    posA: [number, number, number],
    posB: [number, number, number],
    tension: number,
  ) => void;
} {
  const group = new T.Group();
  const numSegments = 10;
  const segments: T.Mesh[] = [];

  const teamColor = team === 'orange' ? '#ff7700' : '#00b4d8';
  const cordMat = new T.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.4,
    metalness: 0.1,
  });

  for (let i = 0; i < numSegments; i++) {
    const seg = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 1, 6), cordMat);
    seg.castShadow = true;
    group.add(seg);
    segments.push(seg);
  }

  const vA = new T.Vector3();
  const vB = new T.Vector3();
  const dir = new T.Vector3();

  function update(
    posA: [number, number, number],
    posB: [number, number, number],
    tension: number,
  ) {
    vA.set(posA[0], posA[1] + 0.6, posA[2]); // Attach near player hips
    vB.set(posB[0], posB[1] + 0.6, posB[2]);

    // Color shifts based on tension
    if (tension > 0.85) {
      cordMat.color.set('#ff2200'); // Danger snap red
    } else if (tension > 0.5) {
      cordMat.color.set('#ffbb00'); // High tension yellow
    } else {
      cordMat.color.set(teamColor);
    }

    // Calculate curve points with catenary droop
    const slack = Math.max(0, 1 - tension);
    const sag = slack * 0.45; // Sag towards floor when slack

    for (let i = 0; i < numSegments; i++) {
      const t1 = i / numSegments;
      const t2 = (i + 1) / numSegments;

      const p1 = new T.Vector3().lerpVectors(vA, vB, t1);
      const p2 = new T.Vector3().lerpVectors(vA, vB, t2);

      // Apply parabolic droop
      p1.y -= Math.sin(t1 * Math.PI) * sag;
      p2.y -= Math.sin(t2 * Math.PI) * sag;

      const segMid = new T.Vector3().lerpVectors(p1, p2, 0.5);
      const segLen = p1.distanceTo(p2);

      const seg = segments[i];
      seg.position.copy(segMid);
      seg.scale.set(1, segLen, 1);

      // Orient cylinder along segment
      dir.subVectors(p2, p1).normalize();
      seg.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
    }
  }

  return { group, update };
}

/** Ball landing target reticle projected onto the court floor */
export function createLandingTarget(): {
  mesh: T.Mesh;
  update: (x: number, z: number, ballY: number) => void;
} {
  const geo = new T.RingGeometry(0.25, 0.38, 18);
  const mat = new T.MeshBasicMaterial({
    color: '#ffff00',
    transparent: true,
    opacity: 0.7,
    side: T.DoubleSide,
  });
  const mesh = new T.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;

  function update(x: number, z: number, ballY: number) {
    mesh.position.x = x;
    mesh.position.z = z;
    // Scale ring smaller as ball gets closer to floor
    const scale = Math.max(0.5, Math.min(2.5, ballY * 0.4));
    mesh.scale.set(scale, scale, 1);
    mat.opacity = Math.max(0.2, 0.85 - ballY * 0.08);
  }

  return { mesh, update };
}
