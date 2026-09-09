import type { World } from './model';
import { makeInspection } from './inspection';
export type DailyJob = {
  version: 1;
  date: string;
  variant: number;
  title: string;
};
const JOBS = [
  {
    title: 'Rain check',
    target: { x: -2, z: -1 },
    origin: { x: 3, z: 6 },
    rain: 45000,
  },
  {
    title: 'The corner office',
    target: { x: 2, z: -2 },
    origin: { x: -3, z: 6 },
    rain: 75000,
  },
  {
    title: 'Long way to lunch',
    target: { x: 0, z: -3 },
    origin: { x: 4, z: 6 },
    rain: 100000,
  },
];
export function dailyJob(date: string): DailyJob {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error('Choose a valid daily challenge date.');
  const time = Date.parse(date + 'T00:00:00Z');
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== date
  )
    throw new Error('Choose a valid daily challenge date.');
  const variant =
    ((Math.floor(time / 86400000) % JOBS.length) + JOBS.length) % JOBS.length;
  return { version: 1, date, variant, title: JOBS[variant].title };
}
export function setDaily(world: World, date: string, now: number) {
  const p = world.party!;
  if (!p) throw new Error('Daily challenges need crew jobs enabled.');
  const daily = dailyJob(date),
    job = JOBS[daily.variant];
  p.daily = daily;
  p.format = 'inspection';
  p.job = 'sofa';
  p.inspection = makeInspection(job.target);
  Object.assign(p.task, {
    kind: 'sofa',
    origin: { ...job.origin },
    target: { ...job.target },
    ...job.origin,
  });
  p.inspection.rainAt = now + job.rain;
  p.inspection.rainUntil = now + job.rain + 80000;
  p.seed = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000) >>> 0;
}
