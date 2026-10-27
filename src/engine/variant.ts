import type { Rng } from './rng'

export interface Gated {
  id: string
  /** Niveau minimal de paranoïa (défaut 1). */
  minLevel?: number
  /** Poids de tirage relatif (défaut 1). */
  weight?: number
}

/** Variante aléatoire permise au `level`, en évitant `lastId` sauf si c’est le seul choix. Respecte `weight` (0 = jamais choisie sauf s’il n’y a rien d’autre). */
export const pickVariant = <T extends Gated>(list: readonly T[], level: number, lastId: string | null, rng: Rng): T => {
  const allowed = list.filter((v) => (v.minLevel ?? 1) <= level)
  // Poids 0 = jamais tiré tant qu’une autre variante est possible (forcée par id ailleurs).
  const ok = allowed.some((v) => (v.weight ?? 1) > 0) ? allowed.filter((v) => (v.weight ?? 1) > 0) : allowed
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
