export type AdventureProgress = {
  visited: string[];
  styled: boolean;
  acknowledged: number;
  persistent: boolean;
};

export const ADVENTURE_KEY = 'jy_adventure_v1';
const EMPTY: AdventureProgress = {
  visited: [],
  styled: false,
  acknowledged: 0,
  persistent: true,
};
let current = EMPTY;
let initialized = false;
const listeners = new Set<() => void>();

export function parseAdventure(raw: string | null): AdventureProgress {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (
      !value ||
      typeof value !== 'object' ||
      !('version' in value) ||
      value.version !== 1
    )
      return EMPTY;
    const data = value as Record<string, unknown>;
    const visited = Array.isArray(data.visited)
      ? [
          ...new Set(
            data.visited.filter(
              (slug): slug is string =>
                typeof slug === 'string' && /^[a-z0-9-]{1,64}$/.test(slug),
            ),
          ),
        ].slice(0, 100)
      : [];
    const styled = data.styled === true;
    const total = visited.length + Number(styled);
    const acknowledged =
      typeof data.acknowledged === 'number' &&
      Number.isFinite(data.acknowledged)
        ? Math.max(0, Math.min(total, Math.floor(data.acknowledged)))
        : 0;
    return { visited, styled, acknowledged, persistent: true };
  } catch {
    return EMPTY;
  }
}

export function addAdventureVisit(
  state: AdventureProgress,
  slug: string,
): AdventureProgress {
  if (!/^[a-z0-9-]{1,64}$/.test(slug) || state.visited.includes(slug))
    return state;
  return { ...state, visited: [...state.visited, slug] };
}

export function pickAdventure(
  slugs: string[],
  visited: string[],
  previous: string | null,
  random = Math.random(),
): string | undefined {
  const alternatives = slugs.filter((slug) => slug !== previous);
  const fresh = alternatives.filter((slug) => !visited.includes(slug));
  const pool = fresh.length
    ? fresh
    : alternatives.length
      ? alternatives
      : slugs;
  return pool[
    Math.min(pool.length - 1, Math.max(0, Math.floor(random * pool.length)))
  ];
}

function readStorage() {
  try {
    return parseAdventure(window.localStorage.getItem(ADVENTURE_KEY));
  } catch {
    return { ...current, persistent: false };
  }
}
function init() {
  if (!initialized && typeof window !== 'undefined') {
    current = readStorage();
    initialized = true;
  }
}
function emit() {
  for (const listener of listeners) listener();
}
function save(next: AdventureProgress) {
  current = next;
  try {
    window.localStorage.setItem(
      ADVENTURE_KEY,
      JSON.stringify({ ...next, version: 1 }),
    );
  } catch {
    current = { ...next, persistent: false };
  }
  emit();
}
function refresh() {
  // If a write failed, keep the in-memory session instead of replacing it with
  // stale disk data when the browser restores this page from its back cache.
  if (current.persistent) current = readStorage();
  emit();
}
function onStorage(event: StorageEvent) {
  if (event.key === ADVENTURE_KEY || event.key === null) refresh();
}

export function subscribeAdventure(listener: () => void) {
  init();
  if (listeners.size === 0) {
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', refresh);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', refresh);
    }
  };
}
export function adventureSnapshot() {
  init();
  return current;
}
export function serverAdventureSnapshot() {
  return EMPTY;
}
export function recordAdventureVisit(slug: string) {
  init();
  const next = addAdventureVisit(current, slug);
  if (next !== current) save(next);
}
export function recordAdventureLook() {
  init();
  if (!current.styled) save({ ...current, styled: true });
}
export function acknowledgeAdventure() {
  init();
  save({
    ...current,
    acknowledged: current.visited.length + Number(current.styled),
  });
}
