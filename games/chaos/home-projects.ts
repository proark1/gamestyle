import type { ItemKind, World } from './model';
import { onFoundation } from './maps';

type Goal = {
  kind?: ItemKind;
  count: number;
  use?: boolean;
  painted?: boolean;
  tiled?: boolean;
};
export const HOME_PROJECTS: {
  id: string;
  title: string;
  reward: string;
  description: string;
  goals: Goal[];
}[] = [
  {
    id: 'kitchen',
    title: 'Dinner is served',
    reward: 'Head chef',
    description: 'Fit a kitchen on the foundation, then try the cooker.',
    goals: [
      { kind: 'counter', count: 1 },
      { kind: 'fridge', count: 1 },
      { kind: 'sink', count: 1 },
      { kind: 'stove', count: 1, use: true },
    ],
  },
  {
    id: 'reading',
    title: 'The cozy corner',
    reward: 'Comfort expert',
    description: 'Make somewhere to switch off after the shift.',
    goals: [
      { kind: 'sofa', count: 1 },
      { kind: 'bookshelf', count: 1 },
      { kind: 'lamp', count: 1 },
      { kind: 'plant', count: 1 },
    ],
  },
  {
    id: 'bathroom',
    title: 'Spa day',
    reward: 'Bubble boss',
    description: 'Finish the bathroom and test your bubble bath.',
    goals: [
      { kind: 'bathtub', count: 1, use: true },
      { kind: 'toilet', count: 1 },
      { kind: 'washer', count: 1 },
      { kind: 'floor', count: 4, tiled: true },
    ],
  },
  {
    id: 'bedroom',
    title: 'Five more minutes',
    reward: 'Chief of naps',
    description: 'Build a bedroom with room for books and clothes.',
    goals: [
      { kind: 'bed', count: 1 },
      { kind: 'wardrobe', count: 1 },
      { kind: 'bookshelf', count: 1 },
      { kind: 'clock', count: 1 },
    ],
  },
  {
    id: 'creative',
    title: 'Opening night',
    reward: 'Resident artist',
    description: 'Make a music and art corner, then put on a show.',
    goals: [
      { kind: 'piano', count: 1, use: true },
      { kind: 'easel', count: 1, use: true },
      { kind: 'chair', count: 2 },
      { kind: 'aquarium', count: 1, use: true },
    ],
  },
  {
    id: 'color',
    title: 'A splash of personality',
    reward: 'House stylist',
    description: 'Paint three walls or windows and lay four colored tiles.',
    goals: [
      { count: 3, painted: true },
      { kind: 'floor', count: 4, painted: true, tiled: true },
    ],
  },
];
export function homeProgress(world: World) {
  const placed = world.pieces.filter(
    (p) =>
      p.placed &&
      !p.heldBy &&
      !p.hoisted &&
      !p.supply &&
      onFoundation(p, world.map),
  );
  return HOME_PROJECTS.map((project) => {
    const goals = project.goals.map((goal) => {
      const count = placed.filter(
        (p) =>
          (goal.kind
            ? p.kind === goal.kind
            : ['wall', 'window', 'door'].includes(p.kind)) &&
          (!goal.use || p.usedAt !== undefined || p.tried) &&
          (!goal.painted || (!!p.paint && p.paint !== 'original')) &&
          (!goal.tiled || p.finish === 'tiles' || p.finish === 'checker'),
      ).length;
      return { ...goal, done: Math.min(count, goal.count) };
    });
    return {
      ...project,
      goals,
      done: goals.reduce((sum, g) => sum + g.done, 0),
      total: goals.reduce((sum, g) => sum + g.count, 0),
      complete: goals.every((g) => g.done === g.count),
    };
  });
}
