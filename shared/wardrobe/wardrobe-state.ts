import { GOALS, ITEMS, type Goal, type Item, type Slot } from './catalog';
import { parseLook, type Look } from './look';

export type WardrobeStats = {
  gamesPlayed: string[];
  playTimeSeconds: number;
};

export type WardrobeState = {
  look: Look;
  coins: number;
  unlockedItems: string[];
  stats: WardrobeStats;
};

const STORAGE_KEY = 'jy_wardrobe_v1';
const TOTAL_GAMES = 12;

// Default starter items that are unlocked for all players right away
export const DEFAULT_UNLOCKED: readonly string[] = [
  'bobble-beanie',
  'striped-tee',
  'denim-overalls',
  'rain-boots',
  'round-glasses',
];

/**
 * The outfit every player used to start wearing. A saved look that is exactly
 * this was never chosen, so it is read as nothing equipped.
 */
const OLD_STARTER_LOOK: Look = {
  hat: 'bobble-beanie',
  top: 'striped-tee',
  legs: 'denim-overalls',
  shoes: 'rain-boots',
  face: 'round-glasses',
};

// New players start with nothing equipped, so every game shows its own
// costume until they pick items; the starter items are unlocked to try on.
const DEFAULT_STATE: WardrobeState = {
  look: {},
  coins: 500, // Welcoming starting balance for party perks & shopping
  unlockedItems: [...DEFAULT_UNLOCKED],
  stats: {
    gamesPlayed: [],
    playTimeSeconds: 0,
  },
};

let currentState: WardrobeState = DEFAULT_STATE;
let initialized = false;
const listeners = new Set<() => void>();

function loadFromStorage(): WardrobeState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<WardrobeState>;
    const look = storedLook(parsed.look);
    const coins =
      typeof parsed.coins === 'number'
        ? Math.max(0, parsed.coins)
        : DEFAULT_STATE.coins;
    const unlockedItems = Array.isArray(parsed.unlockedItems)
      ? Array.from(
          new Set([
            ...DEFAULT_UNLOCKED,
            ...parsed.unlockedItems.filter(
              (id): id is string => typeof id === 'string',
            ),
          ]),
        )
      : [...DEFAULT_UNLOCKED];
    const stats: WardrobeStats = {
      gamesPlayed: Array.isArray(parsed.stats?.gamesPlayed)
        ? parsed.stats!.gamesPlayed.filter(
            (g): g is string => typeof g === 'string',
          )
        : [],
      playTimeSeconds:
        typeof parsed.stats?.playTimeSeconds === 'number'
          ? Math.max(0, parsed.stats!.playTimeSeconds)
          : 0,
    };
    return { look, coins, unlockedItems, stats };
  } catch {
    return DEFAULT_STATE;
  }
}

/** The look a saved wardrobe holds, with the old untouched starter outfit read as empty. */
export function storedLook(raw: unknown): Look {
  const look = parseLook(raw);
  if (!look) return {};
  const slots = Object.keys(look) as (keyof Look)[];
  const starter = Object.keys(OLD_STARTER_LOOK) as (keyof Look)[];
  const untouched =
    slots.length === starter.length &&
    starter.every((slot) => look[slot] === OLD_STARTER_LOOK[slot]);
  return untouched ? {} : look;
}

function saveToStorage(state: WardrobeState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or disabled errors
  }
}

function emit() {
  saveToStorage(currentState);
  for (const listener of listeners) {
    listener();
  }
}

function ensureInit() {
  if (!initialized && typeof window !== 'undefined') {
    currentState = loadFromStorage();
    initialized = true;
  }
}

export function subscribeWardrobe(listener: () => void): () => void {
  ensureInit();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function wardrobeSnapshot(): WardrobeState {
  ensureInit();
  return currentState;
}

export function serverWardrobeSnapshot(): WardrobeState {
  return DEFAULT_STATE;
}

export function getEquippedLook(): Look {
  ensureInit();
  return currentState.look;
}

export function isItemUnlocked(state: WardrobeState, item: Item): boolean {
  if (state.unlockedItems.includes(item.id)) return true;
  if (DEFAULT_UNLOCKED.includes(item.id)) return true;
  return false;
}

export function equipItem(slot: Slot, itemId: string | null) {
  ensureInit();
  const nextLook = { ...currentState.look };
  if (!itemId) {
    delete nextLook[slot];
  } else {
    const item = ITEMS.find((i) => i.id === itemId && i.slot === slot);
    if (!item) return;
    if (!isItemUnlocked(currentState, item)) return;
    nextLook[slot] = itemId;
  }
  currentState = {
    ...currentState,
    look: nextLook,
  };
  emit();
}

export function buyItem(itemId: string): boolean {
  ensureInit();
  const item = ITEMS.find((i) => i.id === itemId);
  if (!item || !item.price) return false;
  if (isItemUnlocked(currentState, item)) return true;
  if (currentState.coins < item.price) return false;

  currentState = {
    ...currentState,
    coins: currentState.coins - item.price,
    unlockedItems: [...currentState.unlockedItems, item.id],
  };
  emit();
  return true;
}

export function checkAndUnlockGoals(): string[] {
  ensureInit();
  const newlyUnlocked: string[] = [];
  const nextUnlocked = new Set(currentState.unlockedItems);

  for (const goal of GOALS) {
    const progress = getGoalProgress(goal, currentState.stats);
    if (progress.complete) {
      const rewardItem = ITEMS.find((i) => i.goal === goal.id);
      if (rewardItem && !nextUnlocked.has(rewardItem.id)) {
        nextUnlocked.add(rewardItem.id);
        newlyUnlocked.push(rewardItem.id);
      }
    }
  }

  if (newlyUnlocked.length > 0) {
    currentState = {
      ...currentState,
      unlockedItems: Array.from(nextUnlocked),
    };
    emit();
  }
  return newlyUnlocked;
}

export function getGoalProgress(
  goal: Goal,
  stats: WardrobeStats,
): { current: number; target: number; complete: boolean; percentage: number } {
  if (goal.measure === 'every-game') {
    const current = Math.min(TOTAL_GAMES, stats.gamesPlayed.length);
    const target = TOTAL_GAMES;
    return {
      current,
      target,
      complete: current >= target,
      percentage: Math.min(100, Math.round((current / target) * 100)),
    };
  }

  if (goal.measure === 'games') {
    const target = goal.target ?? 5;
    const current = Math.min(target, stats.gamesPlayed.length);
    return {
      current,
      target,
      complete: current >= target,
      percentage: Math.min(100, Math.round((current / target) * 100)),
    };
  }

  // hours
  const hoursPlayed = Math.floor(stats.playTimeSeconds / 3600);
  const target = goal.target ?? 10;
  const current = Math.min(target, hoursPlayed);
  return {
    current,
    target,
    complete: current >= target,
    percentage: Math.min(100, Math.round((current / target) * 100)),
  };
}

export function recordGamePlayed(gameId: string) {
  ensureInit();
  if (!currentState.stats.gamesPlayed.includes(gameId)) {
    currentState = {
      ...currentState,
      coins: currentState.coins + 50, // Reward bonus coins for trying a new game!
      stats: {
        ...currentState.stats,
        gamesPlayed: [...currentState.stats.gamesPlayed, gameId],
      },
    };
    checkAndUnlockGoals();
    emit();
  }
}

export function recordPlayTime(seconds: number) {
  ensureInit();
  if (seconds <= 0) return;
  currentState = {
    ...currentState,
    stats: {
      ...currentState.stats,
      playTimeSeconds: currentState.stats.playTimeSeconds + seconds,
    },
  };
  checkAndUnlockGoals();
  emit();
}

export function adminAddCoins(amount: number = 500) {
  ensureInit();
  currentState = {
    ...currentState,
    coins: currentState.coins + amount,
  };
  emit();
}

export function adminUnlockAllItems() {
  ensureInit();
  currentState = {
    ...currentState,
    unlockedItems: Array.from(
      new Set([...DEFAULT_UNLOCKED, ...ITEMS.map((item) => item.id)]),
    ),
  };
  emit();
}

export function adminResetWardrobe() {
  ensureInit();
  currentState = {
    ...DEFAULT_STATE,
    unlockedItems: [...DEFAULT_UNLOCKED],
    look: { ...DEFAULT_STATE.look },
  };
  emit();
}
