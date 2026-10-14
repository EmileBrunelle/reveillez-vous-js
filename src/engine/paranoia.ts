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
// Escalade rapide au début : un jury fait quelques parties, il doit sentir que ça dérape
// dès la 2e visite et voir l’Illumination (niveau 5) en environ 6 parties.
const THRESHOLDS = [0, 1, 2, 4, 6] as const

export const paranoiaLevel = (visits: number): ParanoiaLevel => {
  const reached = THRESHOLDS.filter((t) => visits >= t).length
  return Math.max(1, reached) as ParanoiaLevel
}
