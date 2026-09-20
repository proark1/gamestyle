import * as T from 'three';
import { box, material } from '../../shared/rendering/primitives';
import { dressedGameAvatar as dressedWorker } from '../../shared/rendering/game-avatar';
import { CLOTH } from '../../shared/rendering/palette';
import {
  GAME_HAND_Y as WORKER_HAND_Y,
  GAME_HEAD_TOP as WORKER_HEAD_TOP,
} from '../../shared/rendering/game-avatar';
import type { Look } from '../../shared/wardrobe/look';
import { BALL_RADIUS, COURT, TEAM_COLORS, type TeamId } from './types';

/** A team colour made lighter or darker, for gear and scenery, never clothes. */
function teamShade(team: TeamId, lightness: number) {
  const colour = new T.Color(TEAM_COLORS[team]).offsetHSL(0, 0, lightness);
  return `#${colour.getHexString()}`;
}

/**
 * Creates a tennis doubles player using the shared worker avatar, the same
 * one in the game and in the admin preview. Dressed in a team polo shirt,
 * sneakers and sweatband, with white shorts, collar and visor.
 */
export function tennisPlayer(team: TeamId, look?: Look) {
  const teamColor = TEAM_COLORS[team];
  const shortsColor = CLOTH.white;
  const shirtColor = teamColor;
  const shoesColor = teamColor;

  const { model: g, worn } = dressedWorker(
    0,
    {
      shirt: shirtColor,
      overalls: shortsColor,
      boots: shoesColor,
      cap: true,
      trousers: false,
    },
    look,
  );

  const body = g.userData.body as T.Group;

  // Sun visor / athletic sweatband if player is not wearing a wardrobe hat
  if (!worn.hat) {
    // Sweatband around forehead
    const band = new T.Mesh(
      new T.TorusGeometry(0.31, 0.035, 8, 32),
      material(teamColor),
    );
    band.rotation.x = Math.PI / 2;
    band.scale.y = 0.94;
    band.position.y = WORKER_HEAD_TOP - 0.08;
    body.add(band);
    // Visor brim extending forward
    box(
      body,
      [0.48, 0.03, 0.22],
      [0, WORKER_HEAD_TOP - 0.02, 0.32],
      CLOTH.white,
    );
  }

  // Polo shirt collar and button placket
  box(body, [0.2, 0.12, 0.03], [0, 0.92, 0.14], CLOTH.white);
  box(body, [0.05, 0.1, 0.04], [0, 0.84, 0.17], CLOTH.white);

  // Padel bat firmly gripped in player's right hand
  const racket = createTennisRacket(team);
  racket.name = 'tennis-racket';
  const armR = g.userData.sleeveR as T.Group | undefined;
  if (armR) {
    racket.position.set(0, WORKER_HAND_Y + 0.01, 0.04);
    racket.rotation.set(Math.PI / 2 + 0.15, 0, 0);
    armR.add(racket);
  } else {
    g.add(racket);
  }
  g.userData.racket = racket;

  return g;
}

/** Creates a stylized low-poly perforated padel bat (pala) */
export function createTennisRacket(team: TeamId): T.Group {
  const g = new T.Group();

  // A brighter shade of the team colour, so the rim reads against the carbon
  const accentColor = teamShade(team, 0.1);
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
  const cord = new T.Mesh(new T.TorusGeometry(0.035, 0.007, 6, 16), accentMat);
  cord.position.set(0, 0.01, 0);
  cord.rotation.x = Math.PI / 2;
  g.add(cord);

  // Bat Throat / Heart
  const throat = new T.Mesh(new T.BoxGeometry(0.1, 0.12, 0.05), carbonMat);
  throat.position.set(0, 0.36, 0);
  throat.castShadow = true;
  g.add(throat);

  // Solid Composite Bat Face (Diamond / Round shape)
  const faceMesh = new T.Mesh(
    new T.CylinderGeometry(0.22, 0.22, 0.06, 16),
    carbonMat,
  );
  faceMesh.position.set(0, 0.6, 0);
  faceMesh.rotation.x = Math.PI / 2;
  faceMesh.scale.set(1.0, 0.7, 1.2);
  faceMesh.castShadow = true;
  g.add(faceMesh);

  // Outer edge protector rim (team colored)
  const rimMesh = new T.Mesh(
    new T.TorusGeometry(0.22, 0.018, 8, 24),
    accentMat,
  );
  rimMesh.position.set(0, 0.6, 0);
  rimMesh.scale.set(1.0, 1.2, 0.7);
  rimMesh.castShadow = true;
  g.add(rimMesh);

  // Signature Padel perforations / drill holes pattern on face
  const holePositions: [number, number][] = [
    [-0.08, 0.54],
    [0, 0.54],
    [0.08, 0.54],
    [-0.1, 0.6],
    [-0.04, 0.6],
    [0.04, 0.6],
    [0.1, 0.6],
    [-0.1, 0.65],
    [-0.04, 0.65],
    [0.04, 0.65],
    [0.1, 0.65],
    [-0.07, 0.7],
    [0, 0.7],
    [0.07, 0.7],
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

/** Creates the complete 3D padel stadium arena scene with net, glass enclosure, bleachers, and floodlights */
export function tennisCourt(): T.Group {
  const g = new T.Group();

  // Arena floor dimensions (wide stadium apron)
  const arenaWidth = 30;
  const arenaLength = 38;

  // Outer stadium surround (dark modern graphite court apron)
  const outerMat = material('#121d28');
  const outerGeo = new T.PlaneGeometry(arenaWidth, arenaLength);
  const outerMesh = new T.Mesh(outerGeo, outerMat);
  outerMesh.rotation.x = -Math.PI / 2;
  outerMesh.receiveShadow = true;
  g.add(outerMesh);

  // Playing court surface: green padel turf, so both the red and the blue
  // team stand out on it (blue players vanished on the old cobalt court).
  const courtMat = material('#5e8a63');
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

  // Sidelines
  addLine(lw, COURT.length, -COURT.width / 2, 0);
  addLine(lw, COURT.length, COURT.width / 2, 0);

  // Service lines (at z = -5.5 and z = 5.5)
  addLine(COURT.width, lw, 0, -COURT.serviceLineZ);
  addLine(COURT.width, lw, 0, COURT.serviceLineZ);

  // Center service line (between service line and net)
  addLine(lw, COURT.serviceLineZ * 2, 0, 0);

  // Center marks at baselines
  addLine(lw, 0.4, 0, -COURT.length / 2 + 0.2);
  addLine(lw, 0.4, 0, COURT.length / 2 - 0.2);

  // --- Padel Net ---
  const netPostMat = material('#22262b');
  const postRadius = 0.07;
  const postHeight = COURT.netHeight + 0.08;
  const postOffset = COURT.width / 2 + 0.35;

  // Left & Right net posts with wire tension crank
  for (const x of [-postOffset, postOffset]) {
    const post = new T.Mesh(
      new T.CylinderGeometry(postRadius, postRadius, postHeight, 12),
      netPostMat,
    );
    post.position.set(x, postHeight / 2, 0);
    post.castShadow = true;
    g.add(post);

    // Tension crank wheel
    const crank = new T.Mesh(
      new T.CylinderGeometry(0.04, 0.04, 0.05, 8),
      material('#ffaa00'),
    );
    crank.position.set(x + (x > 0 ? 0.08 : -0.08), postHeight - 0.1, 0);
    crank.rotation.z = Math.PI / 2;
    g.add(crank);
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
    color: '#151515',
    transparent: true,
    opacity: 0.65,
    side: T.DoubleSide,
    roughness: 0.9,
  });
  const netMesh = new T.Mesh(netGeo, netMat);
  netMesh.position.set(0, COURT.netHeight / 2, 0);
  g.add(netMesh);

  // Center white strap with tension buckle
  box(g, [0.12, COURT.netHeight, 0.05], [0, COURT.netHeight / 2, 0], '#ffffff');
  box(g, [0.14, 0.06, 0.06], [0, COURT.netHeight - 0.04, 0], '#333333');

  // --- Padel Court Enclosure (3.8m Glass Back Walls & Wire Mesh Sides) ---
  const glassMat = new T.MeshStandardMaterial({
    color: '#c2e7ff',
    transparent: true,
    opacity: 0.35,
    roughness: 0.04,
    metalness: 0.15,
    side: T.DoubleSide,
  });

  const frostedDecalMat = new T.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.75,
    side: T.DoubleSide,
  });

  const meshMat = new T.MeshStandardMaterial({
    color: '#283845',
    transparent: true,
    opacity: 0.62,
    roughness: 0.7,
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

    // Official frosted safety vinyl lines across glass at eye levels
    for (const decalY of [1.15, 1.45]) {
      const decal = new T.Mesh(
        new T.PlaneGeometry(COURT.width, 0.04),
        frostedDecalMat,
      );
      decal.position.set(0, decalY, z + (z < 0 ? 0.01 : -0.01));
      g.add(decal);
    }

    // Top horizontal structural beam
    box(g, [COURT.width + 0.16, 0.09, 0.09], [0, wallH, z], postColor);
    // Bottom kickplate trim
    box(g, [COURT.width, 0.12, 0.06], [0, 0.06, z], postColor);

    // Vertical structural posts every 2.6m
    for (const x of [-halfW, -3.9, -1.3, 1.3, 3.9, halfW]) {
      box(g, [0.08, wallH, 0.08], [x, wallH / 2, z], postColor);
      // Small glass fixing brackets
      for (const by of [0.6, 1.8, 3.0]) {
        box(g, [0.12, 0.08, 0.1], [x, by, z], '#475569');
      }
    }
  }

  // --- Side Walls (Glass corners + Wire mesh center + Doorways) ---
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

    // Side frosted safety lines
    for (const decalY of [1.15, 1.45]) {
      for (const cz of [-9.0, 9.0]) {
        const sideDecal = new T.Mesh(
          new T.PlaneGeometry(4.0, 0.04),
          frostedDecalMat,
        );
        sideDecal.position.set(x + (x < 0 ? 0.01 : -0.01), decalY, cz);
        sideDecal.rotation.y = Math.PI / 2;
        g.add(sideDecal);
      }
    }

    // Center wire mesh panels (leaving 1.6m doorway open at center z = 0)
    // North mesh (z from -7.0 to -1.0)
    const meshNorth = new T.Mesh(new T.PlaneGeometry(6.0, 3.0), meshMat);
    meshNorth.position.set(x, 1.5, -4.0);
    meshNorth.rotation.y = Math.PI / 2;
    g.add(meshNorth);

    // South mesh (z from 1.0 to 7.0)
    const meshSouth = new T.Mesh(new T.PlaneGeometry(6.0, 3.0), meshMat);
    meshSouth.position.set(x, 1.5, 4.0);
    meshSouth.rotation.y = Math.PI / 2;
    g.add(meshSouth);

    // Top beam connecting entire side wall
    box(g, [0.08, 0.08, COURT.length], [x, wallH, 0], postColor);
    // Bottom kickplate
    box(g, [0.06, 0.12, COURT.length], [x, 0.06, 0], postColor);

    // Vertical side posts
    for (const z of [-halfL, -7.0, -3.5, -1.0, 1.0, 3.5, 7.0, halfL]) {
      box(g, [0.08, wallH, 0.08], [x, wallH / 2, z], postColor);
    }

    // Entrance doorway padding protectors (Red on west, Blue on east)
    const padColor = x < 0 ? TEAM_COLORS.red : TEAM_COLORS.blue;
    box(g, [0.14, 2.0, 0.14], [x, 1.0, -1.0], padColor);
    box(g, [0.14, 2.0, 0.14], [x, 1.0, 1.0], padColor);
  }

  // --- Spectator Grandstand Bleachers ---
  // West Grandstand (behind x = -6.5), in red by the red bench
  const standZ = 0;
  const standX = -10.2;
  const bleacherLength = 22;

  // 3-tiered riser structure
  for (let tier = 0; tier < 3; tier++) {
    const tierH = 0.5 + tier * 0.45;
    const tierDepth = 1.1;
    const tierX = standX - tier * tierDepth;
    box(
      g,
      [tierDepth, tierH, bleacherLength],
      [tierX, tierH / 2, standZ],
      '#1c2834',
    );

    // Rows of stadium fold-down seats
    const numSeats = 14;
    for (let s = 0; s < numSeats; s++) {
      const sz =
        -bleacherLength / 2 +
        1.2 +
        (s * (bleacherLength - 2.4)) / (numSeats - 1);
      const seatColor =
        (s + tier) % 2 === 0 ? teamShade('red', -0.1) : TEAM_COLORS.red;
      // Seat cushion
      box(g, [0.45, 0.08, 0.45], [tierX, tierH + 0.04, sz], seatColor);
      // Seat backrest
      box(g, [0.08, 0.35, 0.45], [tierX - 0.2, tierH + 0.22, sz], seatColor);
    }
  }

  // East Grandstand (behind x = +6.5), in blue by the blue bench
  const eastStandX = 10.2;
  for (let tier = 0; tier < 3; tier++) {
    const tierH = 0.5 + tier * 0.45;
    const tierDepth = 1.1;
    const tierX = eastStandX + tier * tierDepth;
    box(
      g,
      [tierDepth, tierH, bleacherLength],
      [tierX, tierH / 2, standZ],
      '#1c2834',
    );

    const numSeats = 14;
    for (let s = 0; s < numSeats; s++) {
      const sz =
        -bleacherLength / 2 +
        1.2 +
        (s * (bleacherLength - 2.4)) / (numSeats - 1);
      const seatColor =
        (s + tier) % 2 === 0 ? teamShade('blue', -0.1) : TEAM_COLORS.blue;
      box(g, [0.45, 0.08, 0.45], [tierX, tierH + 0.04, sz], seatColor);
      box(g, [0.08, 0.35, 0.45], [tierX + 0.2, tierH + 0.22, sz], seatColor);
    }
  }

  // --- Sideline Team Benches & Gear by Court Entrance ---
  for (const [bx, bTeam] of [
    [-8.0, 'red'],
    [8.0, 'blue'],
  ] as const) {
    const bColor = TEAM_COLORS[bTeam];
    // Bench seat
    box(g, [0.6, 0.45, 2.4], [bx, 0.22, 0], '#243444');
    box(g, [0.65, 0.06, 2.5], [bx, 0.48, 0], '#334756');

    // Folded team towel on bench
    box(g, [0.4, 0.06, 0.5], [bx, 0.54, -0.6], bColor);

    // Sports duffle bag beside bench
    box(g, [0.35, 0.3, 0.6], [bx, 0.15, 0.8], '#1b2631');
    box(g, [0.36, 0.04, 0.6], [bx, 0.28, 0.8], bColor);

    // Water bottle
    const bottle = new T.Mesh(
      new T.CylinderGeometry(0.06, 0.06, 0.25, 8),
      material('#ffffff'),
    );
    bottle.position.set(bx, 0.64, 0.3);
    g.add(bottle);
  }

  // --- 4 Padel Court LED Floodlight Towers ---
  const floodLightPos: [number, number][] = [
    [-halfW - 0.4, -6.0],
    [halfW + 0.4, -6.0],
    [-halfW - 0.4, 6.0],
    [halfW + 0.4, 6.0],
  ];

  for (const [fx, fz] of floodLightPos) {
    const lightMast = new T.Group();
    lightMast.position.set(fx, 0, fz);

    // Modern tapered structural steel mast (5.8m tall)
    const mast = new T.Mesh(
      new T.CylinderGeometry(0.08, 0.14, 5.8, 8),
      material('#1e293b'),
    );
    mast.position.set(0, 2.9, 0);
    mast.castShadow = true;
    lightMast.add(mast);

    // Double angled LED fixture head
    const dirX = fx < 0 ? 0.4 : -0.4;
    box(lightMast, [0.8, 0.08, 0.08], [dirX, 5.75, 0], '#1e293b');

    // Twin rectangular LED heads
    for (const headZ of [-0.25, 0.25]) {
      const lampHead = new T.Mesh(
        new T.BoxGeometry(0.55, 0.14, 0.32),
        material('#2c3e50'),
      );
      lampHead.position.set(dirX * 1.6, 5.68, headZ);
      lampHead.rotation.z = fx < 0 ? -0.4 : 0.4;
      lightMast.add(lampHead);

      // Glowing LED emitter face
      const ledPlane = new T.Mesh(
        new T.PlaneGeometry(0.48, 0.26),
        new T.MeshBasicMaterial({ color: '#f1f5f9' }),
      );
      ledPlane.position.set(dirX * 1.6, 5.6, headZ);
      ledPlane.rotation.x = Math.PI / 2;
      lightMast.add(ledPlane);
    }

    g.add(lightMast);
  }

  // --- Elevated Stadium Tournament Ribbon Banner Display ---
  const bannerY = 4.6;
  const bannerZ = halfL + 1.2;
  box(g, [14.0, 0.75, 0.15], [0, bannerY, -bannerZ], '#0f172a');
  box(g, [13.8, 0.65, 0.02], [0, bannerY, -bannerZ + 0.08], '#0284c7');

  box(g, [14.0, 0.75, 0.15], [0, bannerY, bannerZ], '#0f172a');
  box(g, [13.8, 0.65, 0.02], [0, bannerY, bannerZ - 0.08], '#0284c7');

  return g;
}

/**
 * How a cord shows strain. Red and blue are team colours now, so the warning
 * is amber and the near-snap state strobes gold to white: colours neither
 * team's cord wears.
 */
const STRAIN_AMBER = new T.Color('#ffaa00');
const SNAP_GOLD = new T.Color(CLOTH.gold);
const SNAP_WHITE = new T.Color('#ffffff');

/** Dynamic Bungee Cord 3D Mesh connecting two players with tension vibration and carabiners */
export function createBungeeCord(team: TeamId): {
  group: T.Group;
  update: (
    posA: [number, number, number],
    posB: [number, number, number],
    tension: number,
    clock?: number,
  ) => void;
} {
  const group = new T.Group();
  const numSegments = 12;
  const segments: T.Mesh[] = [];

  // A brighter shade of the team colour, so the thin cord reads on the court
  const teamColor = teamShade(team, 0.1);
  const cordMat = new T.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.3,
    metalness: 0.2,
  });

  for (let i = 0; i < numSegments; i++) {
    const seg = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 1, 8), cordMat);
    seg.castShadow = true;
    group.add(seg);
    segments.push(seg);
  }

  // Hip attachment carabiner clips
  const clipMat = new T.MeshStandardMaterial({
    color: '#94a3b8',
    metalness: 0.8,
    roughness: 0.2,
  });
  const clipA = new T.Mesh(new T.TorusGeometry(0.065, 0.018, 8, 16), clipMat);
  const clipB = new T.Mesh(new T.TorusGeometry(0.065, 0.018, 8, 16), clipMat);
  group.add(clipA);
  group.add(clipB);

  const vA = new T.Vector3();
  const vB = new T.Vector3();
  const dir = new T.Vector3();

  function update(
    posA: [number, number, number],
    posB: [number, number, number],
    tension: number,
    clock = 0,
  ) {
    vA.set(posA[0], posA[1] + 0.6, posA[2]); // Hip attachment point
    vB.set(posB[0], posB[1] + 0.6, posB[2]);

    clipA.position.copy(vA);
    clipB.position.copy(vB);

    // Dynamic color & emissive glow based on tension
    if (tension > 0.82) {
      // About to snap: a bright gold-to-white strobe
      const flash = 0.5 + Math.sin(clock * 20) * 0.5;
      cordMat.color.copy(SNAP_GOLD).lerp(SNAP_WHITE, flash);
      cordMat.emissive.copy(SNAP_GOLD);
      cordMat.emissiveIntensity = 0.4 + flash * 0.5;
    } else if (tension > 0.52) {
      cordMat.color.copy(STRAIN_AMBER); // Warning amber
      cordMat.emissive.copy(STRAIN_AMBER);
      cordMat.emissiveIntensity = 0.25;
    } else {
      cordMat.color.set(teamColor);
      cordMat.emissive.set('#000000');
      cordMat.emissiveIntensity = 0;
    }

    const slack = Math.max(0, 1 - tension);
    const sag = slack * 0.45;
    // Harmonic high-tension vibration
    const vibration = tension > 0.5 ? Math.sin(clock * 32) * tension * 0.03 : 0;

    for (let i = 0; i < numSegments; i++) {
      const t1 = i / numSegments;
      const t2 = (i + 1) / numSegments;

      const p1 = new T.Vector3().lerpVectors(vA, vB, t1);
      const p2 = new T.Vector3().lerpVectors(vA, vB, t2);

      p1.y -= Math.sin(t1 * Math.PI) * sag;
      p2.y -= Math.sin(t2 * Math.PI) * sag;

      if (vibration !== 0) {
        p1.y += Math.sin(t1 * Math.PI * 2) * vibration;
        p2.y += Math.sin(t2 * Math.PI * 2) * vibration;
      }

      const segMid = new T.Vector3().lerpVectors(p1, p2, 0.5);
      const segLen = p1.distanceTo(p2);

      const seg = segments[i];
      seg.position.copy(segMid);
      seg.scale.set(1, segLen, 1);

      dir.subVectors(p2, p1).normalize();
      seg.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
    }
  }

  return { group, update };
}

/** Ball landing target reticle and soft contact shadow on court floor */
export function createLandingTarget(): {
  mesh: T.Group;
  update: (x: number, z: number, ballY: number, clock?: number) => void;
} {
  const g = new T.Group();

  // 1. Soft radial contact shadow
  const shadowGeo = new T.CircleGeometry(0.4, 24);
  const shadowMat = new T.MeshBasicMaterial({
    color: '#071520',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const shadowMesh = new T.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.015;
  g.add(shadowMesh);

  // 2. High-tech arcade reticle ring
  const ringGeo = new T.RingGeometry(0.25, 0.34, 28);
  const ringMat = new T.MeshBasicMaterial({
    color: '#ffd166',
    transparent: true,
    opacity: 0.85,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const ringMesh = new T.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.02;
  g.add(ringMesh);

  // 3. Four crosshair target ticks
  const tickMat = new T.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const tick = new T.Mesh(new T.PlaneGeometry(0.045, 0.12), tickMat);
    tick.rotation.x = -Math.PI / 2;
    tick.rotation.z = angle;
    tick.position.set(Math.cos(angle) * 0.38, 0.022, Math.sin(angle) * 0.38);
    g.add(tick);
  }

  function update(x: number, z: number, ballY: number, clock = 0) {
    g.position.x = x;
    g.position.z = z;

    // Contact shadow shrinks and darkens as ball descends to turf
    const shadowScale = Math.max(0.4, Math.min(2.0, 0.6 + ballY * 0.2));
    shadowMesh.scale.set(shadowScale, shadowScale, 1);
    shadowMat.opacity = Math.max(0.12, 0.58 - ballY * 0.06);

    // Reticle contracts tightly toward center for impact timing
    const ringScale = Math.max(0.45, Math.min(2.2, ballY * 0.32 + 0.35));
    ringMesh.scale.set(ringScale, ringScale, 1);
    ringMesh.rotation.z = clock * 2.0;
    ringMat.opacity = Math.max(0.2, 0.9 - ballY * 0.07);
  }

  return { mesh: g, update };
}
