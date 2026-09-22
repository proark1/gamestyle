const WEEK = 7 * 86400000;
const MONDAY = Date.UTC(2026, 8, 21);
export const STACK_MASTERY = [
  { id: 'bronze', label: 'Steady builder', height: 3, coins: 50 },
  { id: 'silver', label: 'High rise', height: 6, coins: 100 },
  { id: 'gold', label: 'Rescue crew', height: null, coins: 200 },
] as const;
export function stackWeek(now: number) {
  const index = Math.floor((now - MONDAY) / WEEK);
  const start = MONDAY + index * WEEK;
  return {
    start,
    end: start + WEEK,
    height: [3, 4, 5, 6][((index % 4) + 4) % 4],
    coins: 100,
  };
}
export type StackProgress = {
  week: ReturnType<typeof stackWeek>;
  weeklyComplete: boolean;
  bestHeight: number;
  milestones: string[];
};
