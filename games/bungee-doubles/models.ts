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

/** Creates a stylized low-poly tennis racket */
export function createTennisRacket(team: TeamId): T.Group {
  const g = new T.Group();

  const frameColor = team === 'orange' ? '#e65c00' : '#008b8b';
  const frameMat = material(frameColor);
  const gripMat = material('#ffffff');
  const stringMat = new T.MeshStandardMaterial({
    color: '#e8f4f8',
    transparent: true,
    opacity: 0.7,
    roughness: 0.3,
  });

  // Handle / Grip
  const grip = new T.Mesh(
    new T.CylinderGeometry(0.032, 0.035, 0.38, 8),
    gripMat,
  );
  grip.position.set(0, 0.19, 0);
  grip.castShadow = true;
  g.add(grip);

  // Shaft throat
  const throat = new T.Mesh(
    new T.CylinderGeometry(0.028, 0.028, 0.14, 8),
    frameMat,
  );
  throat.position.set(0, 0.44, 0);
  throat.castShadow = true;
  g.add(throat);

  // Oval head frame (hoop)
  const hoop = new T.Mesh(new T.TorusGeometry(0.2, 0.025, 8, 20), frameMat);
  hoop.position.set(0, 0.67, 0);
  hoop.scale.set(0.85, 1.25, 1);
  hoop.castShadow = true;
  g.add(hoop);

  // String face
  const strings = new T.Mesh(new T.PlaneGeometry(0.3, 0.44), stringMat);
  strings.position.set(0, 0.67, 0);
  strings.rotation.y = Math.PI / 2;
  g.add(strings);

  return g;
}

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

  // Perimeter advertising banners / court walls
  const bannerColor = '#16324a';

  // North wall
  box(g, [outerWidth, 0.8, 0.2], [0, 0.4, outerLength / 2], bannerColor);
  // South wall
  box(g, [outerWidth, 0.8, 0.2], [0, 0.4, -outerLength / 2], bannerColor);
  // East wall
  box(g, [0.2, 0.8, outerLength], [outerWidth / 2, 0.4, 0], bannerColor);
  // West wall
  box(g, [0.2, 0.8, outerLength], [-outerWidth / 2, 0.4, 0], bannerColor);

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
