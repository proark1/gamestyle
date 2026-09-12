import * as T from 'three';
import { box } from './primitives';
import { COLORS } from './palette';

/** What a game may change about its worker: the clothes and hat, never the body. */
export type WorkerOutfit = {
  /** Shirt and sleeves, and the cap while it is worn; the player colour by default. */
  shirt?: string;
  /** Hips, bib, braces and trouser legs. */
  overalls?: string;
  boots?: string;
  /** False leaves the head bare for the game's own hat. */
  cap?: boolean;
};

/** The top of the worker's head, where a game's own hat sits. */
export const WORKER_HEAD_TOP = 1.68;

/**
 * The collection's player character. Games dress it through `outfit`, but its
 * body, face and joints are the same everywhere: `userData.body`, `legL`,
 * `legR`, `armL` and `armR` (also as `legs` and `arms`), feet at the origin,
 * facing +Z.
 */
export function worker(color: number, outfit: WorkerOutfit = {}) {
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);
  g.userData.body = body;
  const c = outfit.shirt ?? COLORS[color % 4];
  const overalls = outfit.overalls ?? '#385d63';
  const boots = outfit.boots ?? '#4c4840';
  box(body, [0.67, 0.66, 0.43], [0, 0.87, 0], c, true);
  box(body, [0.59, 0.25, 0.45], [0, 0.54, 0], overalls, true);
  box(body, [0.34, 0.44, 0.06], [0, 0.81, 0.25], overalls);
  for (const x of [-0.23, 0.23]) {
    box(body, [0.09, 0.5, 0.06], [x, 0.94, 0.24], overalls);
    box(body, [0.1, 0.08, 0.03], [x, 1.07, 0.285], '#ebc35f');
  }
  const head = box(body, [0.52, 0.5, 0.5], [0, 1.43, 0], '#e6b58b', true);
  head.name = 'worker-head';
  if (outfit.cap !== false) {
    box(body, [0.71, 0.13, 0.65], [0, 1.68, 0.03], c, true);
    box(body, [0.57, 0.22, 0.53], [0, 1.81, 0], c, true);
  }
  for (const x of [-0.12, 0.12])
    box(body, [0.055, 0.07, 0.025], [x, 1.45, 0.261], '#283b34');
  box(body, [0.17, 0.08, 0.13], [0, 1.35, 0.29], '#d49670', true);
  const legs: T.Group[] = [];
  const arms: T.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(side * 0.19, 0.5, 0);
    box(leg, [0.24, 0.38, 0.28], [0, -0.18, 0], overalls, true);
    box(leg, [0.3, 0.18, 0.43], [0, -0.41, 0.065], boots, true);
    body.add(leg);
    g.userData[side === 1 ? 'legR' : 'legL'] = leg;
    legs.push(leg);
    const arm = new T.Group();
    arm.position.set(side * 0.43, 1.08, 0);
    box(arm, [0.22, 0.36, 0.28], [0, -0.12, 0], c, true);
    const hand = box(arm, [0.22, 0.21, 0.25], [0, -0.37, 0], '#e6b58b', true);
    hand.name = 'worker-hand';
    body.add(arm);
    g.userData[side === 1 ? 'armR' : 'armL'] = arm;
    arms.push(arm);
  }
  g.userData.legs = legs;
  g.userData.arms = arms;
  return g;
}
