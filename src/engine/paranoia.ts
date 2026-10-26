export type ParanoiaLevel = 1 | 2 | 3 | 4 | 5

/**
 * Maps the number of times the door was reopened in this browser to a paranoia level.
 *
 * Contract:
 * - `visits` is the count of « Fermer la porte » clicks persisted in this browser; integer, >= 0.
 * - Must return an integer in 1..5 for every `visits` >= 0.
 * - Expected default: monotonic non-decreasing (the tract never gets calmer as visits grow).
 */
// Visites nécessaires pour atteindre chaque niveau (index 0 = niveau 1).
// Montée plus lente : N1 aux visites 0-1, N2 à la 2, N3 aux 3-4, N4 aux 5-6, N5 à la 7, puis la finale.
const THRESHOLDS = [0, 2, 3, 5, 7] as const

export const paranoiaLevel = (visits: number): ParanoiaLevel => {
  const reached = THRESHOLDS.filter((t) => visits >= t).length
  return Math.max(1, reached) as ParanoiaLevel
}
