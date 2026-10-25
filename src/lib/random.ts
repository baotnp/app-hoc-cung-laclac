/** PRNG có hạt giống (06 §4.3 bước 8) để kế hoạch vòng tái lập được. */
export interface Rng {
  next(): number
  int(maxExclusive: number): number
  pick<T>(xs: readonly T[]): T
  shuffle<T>(xs: readonly T[]): T[]
}

export function createRng(seed: number): Rng {
  let s = (seed >>> 0) || 1
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (maxExclusive: number) => Math.floor(next() * maxExclusive)
  return {
    next,
    int,
    pick<T>(xs: readonly T[]): T {
      if (xs.length === 0) throw new Error('pick: mảng rỗng')
      return xs[int(xs.length)] as T
    },
    shuffle<T>(xs: readonly T[]): T[] {
      const a = [...xs]
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(i + 1)
        const ai = a[i] as T
        a[i] = a[j] as T
        a[j] = ai
      }
      return a
    },
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}
