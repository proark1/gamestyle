import * as T from 'three';
import {
  GOAL_DEPTH,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  PITCH_LENGTH,
  PITCH_WIDTH,
} from './types';

export type StadiumRig = {
  root: T.Group;
  spectators: { mesh: T.Mesh; basePosY: number; phase: number; freq: number }[];
  update: (time: number, celebration: boolean) => void;
};

/** Generates a high-res procedural turf texture with alternating lawn stripes, grass grain, and complete field markings. */
export function createPitchTexture(): T.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;

  // 1. Alternating lawn mower grass stripes across pitch length
  const numStripes = 18;
  const stripeH = canvas.height / numStripes;
  const greenLight = '#43aa38';
  const greenDark = '#38962f';

  for (let i = 0; i < numStripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? greenLight : greenDark;
    ctx.fillRect(0, i * stripeH, canvas.width, stripeH);

    // Subtle grass blade noise lines
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    for (let j = 0; j < 6; j++) {
      ctx.fillRect(0, i * stripeH + j * (stripeH / 6), canvas.width, 2);
    }
  }

  // 2. Pitch Boundary Coordinates
  const marginX = 80;
  const marginY = 120;
  const fieldW = canvas.width - marginX * 2;
  const fieldH = canvas.height - marginY * 2;
  const midX = canvas.width / 2;
  const midY = canvas.height / 2;

  // 3. Field Line Markings (crisp white with subtle anti-glare border)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer boundary line
  ctx.strokeRect(marginX, marginY, fieldW, fieldH);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(marginX, midY);
  ctx.lineTo(marginX + fieldW, midY);
  ctx.stroke();

  // Center circle (radius ~24% of field width)
  const centerRadius = fieldW * 0.22;
  ctx.beginPath();
  ctx.arc(midX, midY, centerRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Center spot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(midX, midY, 12, 0, Math.PI * 2);
  ctx.fill();

  // Penalty Boxes & Goal Areas (Both North & South ends)
  const penBoxW = fieldW * 0.62;
  const penBoxH = fieldH * 0.16;
  const goalBoxW = fieldW * 0.36;
  const goalBoxH = fieldH * 0.07;
  const penSpotDist = fieldH * 0.12;

  for (const isNorth of [true, false]) {
    const endY = isNorth ? marginY + fieldH : marginY;
    const penBoxTop = isNorth ? endY - penBoxH : endY;
    const goalBoxTop = isNorth ? endY - goalBoxH : endY;
    const spotY = isNorth ? endY - penSpotDist : endY + penSpotDist;
    const arcDir = isNorth ? Math.PI : 0;

    // Penalty Box (18-yard box)
    ctx.strokeRect(midX - penBoxW / 2, penBoxTop, penBoxW, penBoxH);

    // Goal Box (6-yard box)
    ctx.strokeRect(midX - goalBoxW / 2, goalBoxTop, goalBoxW, goalBoxH);

    // Penalty Spot
    ctx.beginPath();
    ctx.arc(midX, spotY, 10, 0, Math.PI * 2);
    ctx.fill();

    // Penalty Arc (D outside the penalty box)
    ctx.beginPath();
    ctx.arc(midX, spotY, centerRadius * 0.85, arcDir - 0.7, arcDir + 0.7);
    ctx.stroke();

    // Corner kick quarter-circles
    const cornerR = 30;
    // West corner
    ctx.beginPath();
    ctx.arc(
      marginX,
      endY,
      cornerR,
      isNorth ? -Math.PI / 2 : 0,
      isNorth ? 0 : Math.PI / 2,
    );
    ctx.stroke();
    // East corner
    ctx.beginPath();
    ctx.arc(
      marginX + fieldW,
      endY,
      cornerR,
      isNorth ? Math.PI : Math.PI / 2,
      isNorth ? (Math.PI * 3) / 2 : Math.PI,
    );
    ctx.stroke();
  }

  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = T.ClampToEdgeWrapping;
  texture.wrapT = T.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Builds procedural sponsor dasher board placards. */
function createSponsorPlacardTexture(
  text: string,
  bgColor: string,
  textColor: string,
): T.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border frame
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  // Text
  ctx.fillStyle = textColor;
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new T.CanvasTexture(canvas);
  return tex;
}

/** Builds the full 3D Stadium environment including stands, crowds, floodlights, and goals. */
export function createStadium(): StadiumRig {
  const root = new T.Group();
  const spectators: {
    mesh: T.Mesh;
    basePosY: number;
    phase: number;
    freq: number;
  }[] = [];

  // 1. Striped Grass Turf with complete markings
  const turfGeo = new T.PlaneGeometry(PITCH_WIDTH + 8, PITCH_LENGTH + 12);
  const turfMat = new T.MeshStandardMaterial({
    map: createPitchTexture(),
    roughness: 0.8,
    metalness: 0.05,
  });
  const turf = new T.Mesh(turfGeo, turfMat);
  turf.rotation.x = -Math.PI / 2;
  turf.receiveShadow = true;
  root.add(turf);

  // 2. Concrete Stadium Apron Foundation (y = -0.08, safely under turf)
  const apronGeo = new T.PlaneGeometry(PITCH_WIDTH + 34, PITCH_LENGTH + 38);
  const apronMat = new T.MeshStandardMaterial({
    color: '#1e2430',
    roughness: 0.9,
  });
  const apron = new T.Mesh(apronGeo, apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.08;
  apron.receiveShadow = true;
  root.add(apron);

  // 3. Perimeter Advertising Dasher Boards
  const sponsors = [
    { text: '⚡ ZORB-O-RAMA', bg: '#e63946', color: '#ffffff' },
    { text: '💥 MEGA BONK', bg: '#ffb703', color: '#1e2430' },
    { text: '🐢 TURTLE WAX', bg: '#2a9d8f', color: '#ffffff' },
    { text: '🥤 BOING SODA', bg: '#00b4d8', color: '#ffffff' },
    { text: '🥊 SUMO CRUNCH', bg: '#9d0208', color: '#ffd166' },
    { text: '🚀 ELASTIC CORP', bg: '#7209b7', color: '#ffffff' },
  ];

  const boardH = 1.4;
  const boardMatBase = new T.MeshStandardMaterial({
    color: '#2b2d42',
    roughness: 0.4,
  });

  // West & East board lines with sponsor placards
  for (const side of [-1, 1]) {
    const xPos = side * (PITCH_WIDTH / 2 + 3.2);
    const numPanels = sponsors.length;
    const panelLen = (PITCH_LENGTH + 6) / numPanels;

    for (let i = 0; i < numPanels; i++) {
      const sp = sponsors[i];
      const zPos = -PITCH_LENGTH / 2 - 3 + panelLen * (i + 0.5);

      const boardGeo = new T.BoxGeometry(0.3, boardH, panelLen * 0.96);
      const placardMat = new T.MeshStandardMaterial({
        map: createSponsorPlacardTexture(sp.text, sp.bg, sp.color),
        roughness: 0.3,
      });

      // Multi-material: inner face has sponsor texture
      const boardMesh = new T.Mesh(boardGeo, [
        side < 0 ? placardMat : boardMatBase, // +X face
        side > 0 ? placardMat : boardMatBase, // -X face
        boardMatBase,
        boardMatBase,
        boardMatBase,
        boardMatBase,
      ]);
      boardMesh.position.set(xPos, boardH / 2, zPos);
      boardMesh.castShadow = true;
      boardMesh.receiveShadow = true;
      root.add(boardMesh);
    }
  }

  // North and South outer boundary boards flanking the goals
  const endBoardW = (PITCH_WIDTH + 6.4 - GOAL_WIDTH) / 2;
  for (const zSign of [-1, 1]) {
    const zPos = zSign * (PITCH_LENGTH / 2 + 5.2);
    for (const xSign of [-1, 1]) {
      const xPos = xSign * (GOAL_WIDTH / 2 + endBoardW / 2 + 0.2);
      const endGeo = new T.BoxGeometry(endBoardW, boardH, 0.4);
      const endMesh = new T.Mesh(endGeo, boardMatBase);
      endMesh.position.set(xPos, boardH / 2, zPos);
      endMesh.castShadow = true;
      root.add(endMesh);
    }
  }

  // 4. Spectator Grandstands (Tiered Bleachers on East & West sides)
  const bleacherMat = new T.MeshStandardMaterial({
    color: '#4a5568',
    roughness: 0.6,
  });
  const seatColors = [
    '#f95738',
    '#00b4d8',
    '#ffd166',
    '#06d6a0',
    '#ef476f',
    '#118ab2',
  ];

  for (const side of [-1, 1]) {
    const standX = side * (PITCH_WIDTH / 2 + 7.5);
    const tiers = 4;

    for (let t = 0; t < tiers; t++) {
      const tierW = 1.4;
      const tierH = 0.85;
      const tierY = t * tierH + 0.4;
      const tierX = standX + side * t * 1.3;

      // Bleacher step
      const stepGeo = new T.BoxGeometry(tierW, tierH, PITCH_LENGTH + 14);
      const stepMesh = new T.Mesh(stepGeo, bleacherMat);
      stepMesh.position.set(tierX, tierY, 0);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      root.add(stepMesh);

      // Spectator Crowd silhouettes sitting/standing on the bleacher
      const numFans = 14;
      const fanSpacing = (PITCH_LENGTH + 10) / numFans;

      for (let f = 0; f < numFans; f++) {
        const fanZ =
          -PITCH_LENGTH / 2 - 5 + f * fanSpacing + (Math.random() - 0.5) * 0.8;
        const fanColor = seatColors[(t * 3 + f) % seatColors.length];

        const fanMat = new T.MeshStandardMaterial({
          color: fanColor,
          roughness: 0.5,
        });
        const fanGeo = new T.CylinderGeometry(0.32, 0.38, 0.85, 8);
        const fan = new T.Mesh(fanGeo, fanMat);

        const basePosY = tierY + tierH / 2 + 0.42;
        fan.position.set(tierX, basePosY, fanZ);
        fan.castShadow = true;

        // Fan head
        const headMat = new T.MeshStandardMaterial({
          color: '#fcd5ce',
          roughness: 0.6,
        });
        const headGeo = new T.SphereGeometry(0.24, 8, 8);
        const head = new T.Mesh(headGeo, headMat);
        head.position.set(0, 0.62, 0);
        fan.add(head);

        // Team Cap
        const capMat = new T.MeshStandardMaterial({
          color: fanColor,
          roughness: 0.4,
        });
        const capGeo = new T.CylinderGeometry(0.26, 0.28, 0.12, 8);
        const cap = new T.Mesh(capGeo, capMat);
        cap.position.set(0, 0.76, 0);
        fan.add(cap);

        root.add(fan);
        spectators.push({
          mesh: fan,
          basePosY,
          phase: f * 0.4 + t * 0.7,
          freq: 2.5 + Math.random() * 2,
        });
      }
    }
  }

  // 5. Four Stadium Steel Lattice Floodlight Towers
  const floodlightPositions = [
    [-PITCH_WIDTH / 2 - 6, -PITCH_LENGTH / 2 - 6],
    [PITCH_WIDTH / 2 + 6, -PITCH_LENGTH / 2 - 6],
    [-PITCH_WIDTH / 2 - 6, PITCH_LENGTH / 2 + 6],
    [PITCH_WIDTH / 2 + 6, PITCH_LENGTH / 2 + 6],
  ];

  const trussMat = new T.MeshStandardMaterial({
    color: '#718096',
    metalness: 0.6,
    roughness: 0.3,
  });
  const lampMat = new T.MeshStandardMaterial({
    color: '#fffff0',
    emissive: '#fff4cc',
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });

  for (const [fx, fz] of floodlightPositions) {
    const towerH = 22;
    // Main column
    const colGeo = new T.CylinderGeometry(0.35, 0.55, towerH, 8);
    const col = new T.Mesh(colGeo, trussMat);
    col.position.set(fx, towerH / 2, fz);
    col.castShadow = true;
    root.add(col);

    // Diagonal support legs
    for (let a = 0; a < 4; a++) {
      const angle = (a * Math.PI) / 2;
      const legGeo = new T.CylinderGeometry(0.12, 0.16, towerH * 0.5, 6);
      const leg = new T.Mesh(legGeo, trussMat);
      leg.position.set(
        fx + Math.cos(angle) * 1.4,
        (towerH * 0.5) / 2,
        fz + Math.sin(angle) * 1.4,
      );
      leg.rotation.z = Math.cos(angle) * 0.08;
      leg.rotation.x = Math.sin(angle) * 0.08;
      root.add(leg);
    }

    // Top Floodlight Bank (6 glowing lamps)
    const bankGeo = new T.BoxGeometry(3.2, 1.8, 0.6);
    const bank = new T.Mesh(bankGeo, trussMat);
    bank.position.set(fx, towerH, fz);
    bank.lookAt(0, 4, 0); // Aimed down towards center of pitch
    root.add(bank);

    for (let lx = -1; lx <= 1; lx++) {
      for (let ly = -0.4; ly <= 0.4; ly += 0.8) {
        const lampGeo = new T.CylinderGeometry(0.36, 0.42, 0.3, 12);
        const lamp = new T.Mesh(lampGeo, lampMat);
        lamp.rotation.x = Math.PI / 2;
        lamp.position.set(lx * 0.9, ly, 0.3);
        bank.add(lamp);
      }
    }

    // Real Point Light from tower head
    const pLight = new T.PointLight('#fff3db', 1.0, 50, 1.3);
    pLight.position.set(fx, towerH, fz);
    root.add(pLight);
  }

  // 6. Corner Flags at the 4 pitch corners
  const cornerCoords = [
    [-PITCH_WIDTH / 2, -PITCH_LENGTH / 2, '#f95738'],
    [PITCH_WIDTH / 2, -PITCH_LENGTH / 2, '#f95738'],
    [-PITCH_WIDTH / 2, PITCH_LENGTH / 2, '#00b4d8'],
    [PITCH_WIDTH / 2, PITCH_LENGTH / 2, '#00b4d8'],
  ];

  for (const [cx, cz, color] of cornerCoords) {
    const poleGeo = new T.CylinderGeometry(0.04, 0.04, 1.8, 8);
    const poleMat = new T.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.2,
    });
    const pole = new T.Mesh(poleGeo, poleMat);
    pole.position.set(Number(cx), 0.9, Number(cz));
    root.add(pole);

    // Pennant Flag
    const flagGeo = new T.PlaneGeometry(0.5, 0.35);
    const flagMat = new T.MeshStandardMaterial({
      color,
      side: T.DoubleSide,
      roughness: 0.4,
    });
    const flag = new T.Mesh(flagGeo, flagMat);
    flag.position.set(Number(cx) + 0.26, 1.55, Number(cz));
    root.add(flag);
  }

  // 7. Goal Nets (Red Team South at -Z, Blue Team North at +Z)
  const postMat = new T.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.15,
    metalness: 0.2,
  });
  const netMat = new T.MeshStandardMaterial({
    color: '#ffffff',
    wireframe: true,
    transparent: true,
    opacity: 0.4,
  });

  const halfGoalW = GOAL_WIDTH / 2;
  const goalZ = PITCH_LENGTH / 2;

  const buildGoal = (sign: number, accentColor: string) => {
    const g = new T.Group();
    g.position.set(0, 0, sign * goalZ);

    const accentMat = new T.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.25,
    });

    // Vertical Posts
    for (const side of [-1, 1]) {
      const postGeo = new T.CylinderGeometry(0.16, 0.16, GOAL_HEIGHT, 16);
      const post = new T.Mesh(postGeo, postMat);
      post.position.set(side * halfGoalW, GOAL_HEIGHT / 2, 0);
      post.castShadow = true;
      g.add(post);

      // Team accent stripe on post
      const stripeGeo = new T.CylinderGeometry(0.17, 0.17, 0.35, 16);
      const stripe = new T.Mesh(stripeGeo, accentMat);
      stripe.position.set(side * halfGoalW, GOAL_HEIGHT - 0.4, 0);
      g.add(stripe);

      // Ground anchor rails extending back
      const railGeo = new T.CylinderGeometry(0.1, 0.1, GOAL_DEPTH, 8);
      const rail = new T.Mesh(railGeo, postMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(side * halfGoalW, 0.1, sign * (GOAL_DEPTH / 2));
      g.add(rail);
    }

    // Crossbar
    const barGeo = new T.CylinderGeometry(0.16, 0.16, GOAL_WIDTH, 16);
    const bar = new T.Mesh(barGeo, postMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, GOAL_HEIGHT, 0);
    bar.castShadow = true;
    g.add(bar);

    // Deep Net Enclosure with realistic netting
    const netGeo = new T.BoxGeometry(
      GOAL_WIDTH - 0.2,
      GOAL_HEIGHT - 0.2,
      GOAL_DEPTH,
    );
    const net = new T.Mesh(netGeo, netMat);
    net.position.set(0, GOAL_HEIGHT / 2, sign * (GOAL_DEPTH / 2));
    g.add(net);

    root.add(g);
  };

  buildGoal(-1, '#f95738'); // Red Goal South
  buildGoal(1, '#00b4d8'); // Blue Goal North

  const update = (time: number, celebration: boolean) => {
    // Animate cheering spectators
    for (const s of spectators) {
      const cheerAmp = celebration ? 0.35 : 0.08;
      const cheerFreq = celebration ? s.freq * 2.2 : s.freq;
      const bob = Math.abs(Math.sin(time * cheerFreq + s.phase)) * cheerAmp;
      s.mesh.position.y = s.basePosY + bob;
      if (celebration) {
        s.mesh.rotation.y = Math.sin(time * 6 + s.phase) * 0.25;
      }
    }
  };

  return { root, spectators, update };
}
