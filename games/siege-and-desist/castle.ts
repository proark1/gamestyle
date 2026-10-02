import {
  CASTLE,
  CASTLE_BLUE,
  CASTLE_RED,
  type Block,
  type TeamId,
} from './types';

const STONE = ['#a89a83', '#9d8f79', '#b0a289'];
/** Course pitch and block height leave a hair of clearance, never an overlap. */
const COURSE = 1.08;
const HEIGHT = 1.06;
const BASE = HEIGHT / 2;
/** The gate opening, and where the flanking towers begin. */
const GATE = 2.4;
const TOWER = 3.0;
const WALL_START = GATE + TOWER;
const WALL_END = WALL_START + 6;
const KEEP_COURSES = 7;
const BASE_COURSES = 3;

function block(
  out: Block[],
  part: Block['part'],
  size: number[],
  pos: number[],
  color: string,
  team?: TeamId,
  towerIndex?: 0 | 1 | 2,
  mascotKind?: 'rooster' | 'banner' | 'cheese',
): Block {
  const b: Block = {
    id: out.length,
    part,
    w: size[0],
    h: size[1],
    d: size[2],
    x: pos[0],
    y: pos[1],
    z: pos[2],
    qx: 0,
    qy: 0,
    qz: 0,
    qw: 1,
    color,
    homeX: pos[0],
    homeY: pos[1],
    homeZ: pos[2],
    burning: 0,
    sleeping: true,
    fallen: false,
    team,
    towerIndex,
    mascotKind,
  };
  out.push(b);
  return b;
}

/** Running-bond courses for one curtain-wall side, tiled without overlaps. */
function courseSpans(course: number) {
  const spans: [number, number][] = [];
  if (course % 2 === 0)
    for (let x = WALL_START; x < WALL_END - 0.01; x += 2)
      spans.push([x, x + 2]);
  else {
    spans.push([WALL_START, WALL_START + 1]);
    for (let x = WALL_START + 1; x < WALL_END - 1.01; x += 2)
      spans.push([x, x + 2]);
    spans.push([WALL_END - 1, WALL_END]);
  }
  return spans;
}

/**
 * The keep is laid out as loose masonry rather than one welded mesh, so the
 * solver decides how it comes apart. Blocks are seated on the course below with
 * only a hair of clearance: an overlapping stack would explode on the first
 * step, and a floating one could never be knocked down.
 */
export function buildCastle(): Block[] {
  const out: Block[] = [];
  const wallZ = CASTLE.z + 5;
  for (let course = 0; course < 3; course++) {
    const y = BASE + course * COURSE;
    for (const [from, to] of courseSpans(course))
      for (const side of [-1, 1])
        block(
          out,
          'wall',
          [(to - from) * 0.98, HEIGHT, 1.5],
          [side * ((from + to) / 2), y, wallZ],
          STONE[(Math.round(from) + course) % 3],
        );
  }
  // Timber gate leaves filling the opening. They are the softest thing here.
  for (const side of [-1, 1])
    for (let course = 0; course < 2; course++)
      block(
        out,
        'gate',
        [GATE * 0.94, 1.3, 0.7],
        [side * (GATE / 2), 0.67 + course * 1.32, wallZ],
        course ? '#6f4c2e' : '#7d5734',
      );
  // Gatehouse towers, seated flush against the gate opening.
  for (const side of [-1, 1])
    for (let course = 0; course < 5; course++)
      block(
        out,
        'tower',
        [TOWER * 0.98, HEIGHT, 2.5],
        [side * (GATE + TOWER / 2), BASE + course * COURSE, wallZ],
        STONE[(course + 1) % 3],
      );
  // The keep tapers: a broad four-by-four base carries a narrower tower. A
  // straight-sided stack of loose cubes folds completely to the first solid
  // hit, which ends the siege before the crew has learned the range.
  const keepZ = CASTLE.z - 3;
  const WIDE = [-1.65, -0.55, 0.55, 1.65];
  const NARROW = [-1.1, 0, 1.1];
  for (let course = 0; course < KEEP_COURSES; course++) {
    const top = course === KEEP_COURSES - 1;
    const grid = course < BASE_COURSES ? WIDE : NARROW;
    const size = course < BASE_COURSES ? 1.08 : 1.08;
    for (const dx of grid)
      for (const dz of grid) {
        // The last course is a ring: the banner is set into the well it leaves.
        if (top && Math.abs(dx) < 0.6 && Math.abs(dz) < 0.6) continue;
        block(
          out,
          'keep',
          [size, HEIGHT, size],
          [CASTLE.x + dx, BASE + course * COURSE, keepZ + dz],
          STONE[(course + (dx > 0 ? 1 : 0) + (dz > 0 ? 1 : 0)) % 3],
        );
      }
  }
  // The banner is seated in that well, walled in on every side. It can only
  // reach the ground once the crew has actually taken the keep apart, rather
  // than clipping a pole off an otherwise intact roof.
  const well = BASE + (KEEP_COURSES - 2) * COURSE + HEIGHT / 2;
  const pole = 3.4;
  block(
    out,
    'banner',
    [0.5, pole, 0.5],
    [CASTLE.x, well + pole / 2, keepZ],
    '#7a4a24',
  );
  return out;
}

/** Battlement positions the defenders throw their clay pots from. */
export function defenderPosts() {
  const wallZ = CASTLE.z + 5;
  const towerTop = BASE + 4 * COURSE + HEIGHT;
  const wallTop = BASE + 2 * COURSE + HEIGHT;
  return [
    { x: -(GATE + TOWER / 2), y: towerTop, z: wallZ },
    { x: GATE + TOWER / 2, y: towerTop, z: wallZ },
    { x: -(WALL_START + 2), y: wallTop, z: wallZ },
    { x: WALL_START + 2, y: wallTop, z: wallZ },
  ];
}

/**
 * Builds two opposing castles for 2v2 Castle Clash:
 * - Blue Castle at North (z = -23.5)
 * - Red Castle at South (z = +23.5)
 * Each castle has three distinct destructible towers:
 * - Tower 0 (Left, x = -8.5): The Golden Rooster mascot on top
 * - Tower 1 (Center, x = 0): The Royal Banner & Keep on top
 * - Tower 2 (Right, x = +8.5): The Giant Sacred Cheese Wheel on top
 */
export function buildClashCastles(): Block[] {
  const out: Block[] = [];
  const teams: TeamId[] = ['blue', 'red'];

  for (const team of teams) {
    const castleZ = team === 'blue' ? CASTLE_BLUE.z : CASTLE_RED.z;
    const facingSign = team === 'blue' ? 1 : -1; // Blue faces south (+z), Red faces north (-z)
    const wallZ = castleZ + facingSign * 2.2;

    // --- Tower 0 (Left Tower at x = -8.5): The Golden Rooster ---
    for (let course = 0; course < 4; course++) {
      const y = BASE + course * COURSE;
      for (const dx of [-0.65, 0.65]) {
        for (const dz of [-0.65, 0.65]) {
          block(
            out,
            'tower',
            [1.25, HEIGHT, 1.25],
            [-8.5 + dx, y, castleZ + dz],
            STONE[(course + (dx > 0 ? 1 : 0)) % 3],
            team,
            0,
          );
        }
      }
    }
    // Rooster Mascot block atop Left Tower
    block(
      out,
      'mascot',
      [1.1, 1.3, 1.1],
      [-8.5, BASE + 3 * COURSE + HEIGHT / 2 + 0.65, castleZ],
      '#d8a13d',
      team,
      0,
      'rooster',
    );

    // --- Tower 1 (Center Keep at x = 0): Royal Banner ---
    const WIDE = [-1.3, 0, 1.3];
    for (let course = 0; course < 5; course++) {
      const y = BASE + course * COURSE;
      const top = course === 4;
      for (const dx of WIDE) {
        for (const dz of [-1.1, 1.1]) {
          if (top && Math.abs(dx) < 0.5) continue; // well for the banner pole
          block(
            out,
            'keep',
            [1.2, HEIGHT, 1.1],
            [dx, y, castleZ + dz],
            STONE[(course + (dx > 0 ? 1 : 0)) % 3],
            team,
            1,
          );
        }
      }
    }
    // Banner block atop Center Keep
    const wellY = BASE + 3 * COURSE + HEIGHT / 2;
    const poleH = 3.2;
    block(
      out,
      'banner',
      [0.5, poleH, 0.5],
      [0, wellY + poleH / 2, castleZ],
      '#7a4a24',
      team,
      1,
      'banner',
    );

    // --- Tower 2 (Right Tower at x = +8.5): The Giant Cheese Wheel ---
    for (let course = 0; course < 4; course++) {
      const y = BASE + course * COURSE;
      for (const dx of [-0.65, 0.65]) {
        for (const dz of [-0.65, 0.65]) {
          block(
            out,
            'tower',
            [1.25, HEIGHT, 1.25],
            [8.5 + dx, y, castleZ + dz],
            STONE[(course + (dx > 0 ? 1 : 0)) % 3],
            team,
            2,
          );
        }
      }
    }
    // Giant Cheese Wheel Mascot block atop Right Tower
    block(
      out,
      'mascot',
      [1.5, 0.85, 1.5],
      [8.5, BASE + 3 * COURSE + HEIGHT / 2 + 0.85 / 2, castleZ],
      '#e8be48',
      team,
      2,
      'cheese',
    );

    // --- Connecting Curtain Walls ---
    for (let course = 0; course < 2; course++) {
      const y = BASE + course * COURSE;
      // Left curtain wall connecting Tower 0 and Center Keep
      for (const x of [-5.5, -3.2]) {
        block(
          out,
          'wall',
          [2.1, HEIGHT, 1.2],
          [x, y, wallZ],
          STONE[(course + Math.abs(Math.round(x))) % 3],
          team,
        );
      }
      // Right curtain wall connecting Center Keep and Tower 2
      for (const x of [3.2, 5.5]) {
        block(
          out,
          'wall',
          [2.1, HEIGHT, 1.2],
          [x, y, wallZ],
          STONE[(course + Math.abs(Math.round(x))) % 3],
          team,
        );
      }
    }
  }

  return out;
}
