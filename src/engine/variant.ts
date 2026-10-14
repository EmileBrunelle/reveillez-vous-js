import type { Rng } from './rng'

export interface Gated {
  id: string
  minLevel: number
}

/** Random variant allowed at `level`, avoiding `lastId` unless it is the only choice. */
export const pickVariant = <T extends Gated>(list: readonly T[], level: number, lastId: string | null, rng: Rng): T => {
  const ok = list.filter((v) => v.minLevel <= level)
  const pool = ok.length > 1 ? ok.filter((v) => v.id !== lastId) : ok
  return (pool.length ? pool : list)[Math.floor(rng() * (pool.length ? pool : list).length)]
}
