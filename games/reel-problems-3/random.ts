export function nextRandom(state: number) {
  const next = (Math.imul(state >>> 0, 1664525) + 1013904223) >>> 0;
  return { state: next, value: next / 4294967296 };
}
export function randomInt(state: number, maximum: number) {
  const next = nextRandom(state);
  return {
    state: next.state,
    value: Math.floor(next.value * Math.max(1, Math.floor(maximum))),
  };
}
export function shuffleSeeded<T>(state: number, values: readonly T[]) {
  const shuffled = [...values];
  let cursor = state >>> 0;
  for (let index = shuffled.length - 1; index > 0; index--) {
    const pick = randomInt(cursor, index + 1);
    cursor = pick.state;
    [shuffled[index], shuffled[pick.value]] = [
      shuffled[pick.value],
      shuffled[index],
    ];
  }
  return { state: cursor, values: shuffled };
}
export function derivedSeed(seed: number, x: number, z: number) {
  let value = seed >>> 0;
  value ^= Math.imul(x | 0, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= Math.imul(z | 0, 0x27d4eb2d);
  return (value ^ (value >>> 15)) >>> 0;
}
