export type Random = () => number

/** Small deterministic generator for reproducible tests and simulations. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomInt(random: Random, max: number): number {
  return Math.min(max - 1, Math.floor(random() * max))
}

export function pick<T>(random: Random, items: readonly T[]): T {
  return items[randomInt(random, items.length)]
}

export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
