import type { Rng } from './rng'

export interface Gated {
  id: string
  minLevel: number
  /** Relative pick weight (default 1). */
  weight?: number
}

/** Random variant allowed at `level`, avoiding `lastId` unless it is the only choice. Honors `weight`. */
export const pickVariant = <T extends Gated>(list: readonly T[], level: number, lastId: string | null, rng: Rng): T => {
  const ok = list.filter((v) => v.minLevel <= level)
  const pool = ok.length > 1 ? ok.filter((v) => v.id !== lastId) : ok
  const from = pool.length ? pool : list
  const total = from.reduce((n, v) => n + (v.weight ?? 1), 0)
  let r = rng() * total
  for (const v of from) {
    r -= v.weight ?? 1
    if (r < 0) return v
  }
  return from[from.length - 1]
}
