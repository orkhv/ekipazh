export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function weightedPick<T>(
  items: T[],
  score: (item: T) => number,
  rng: Rng,
  temperature = 0.35,
): T {
  if (items.length === 1) return items[0]!
  const scores = items.map((item) => score(item))
  const max = Math.max(...scores)
  const weights = scores.map((s) => Math.exp((s - max) / Math.max(temperature, 0.05)))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let cursor = rng() * total
  for (let i = 0; i < items.length; i += 1) {
    cursor -= weights[i]!
    if (cursor <= 0) return items[i]!
  }
  return items[items.length - 1]!
}
