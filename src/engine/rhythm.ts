import type { Rng } from './rng'

/** Pause entre deux coups : courte (« toc toc ») ou longue (« toc — toc »). */
export type Gap = 'court' | 'long'

const clampLevel = (level: number) => Math.min(5, Math.max(1, Math.round(level)))

/** Nombres de coups possibles par niveau (on en tire un au hasard) : difficulté croissante. */
const KNOCK_COUNTS: Record<number, number[]> = { 1: [3, 4], 2: [4], 3: [4, 5], 4: [5], 5: [5, 6] }

/** Tous les motifs valides de `n` pauses : ≥ 1 « court », ≥ 1 « long », jamais deux « long » de suite. */
const validPatterns = (n: number): Gap[][] => {
  const out: Gap[][] = []
  for (let mask = 1; mask < 1 << n; mask++) {
    if (mask & (mask >> 1)) continue // deux longs adjacents
    if (mask === (1 << n) - 1) continue // aucun court
    out.push(Array.from({ length: n }, (_, i): Gap => (mask & (1 << i) ? 'long' : 'court')))
  }
  return out
}

/**
 * Motif que la voyante frappe : les pauses ENTRE les coups (coups = gaps.length + 1).
 * Le nombre de coups varie au sein d’un niveau ; le motif est tiré uniformément parmi les valides
 * (≥ 1 court — il donne le tempo de la personne —, ≥ 1 long, jamais deux longs de suite). Déterministe selon `rng`.
 */
export const rhythmFor = (level: number, rng: Rng): Gap[] => {
  const counts = KNOCK_COUNTS[clampLevel(level)]
  const knocks = counts[Math.floor(rng() * counts.length)]
  const patterns = validPatterns(knocks - 1)
  return patterns[Math.floor(rng() * patterns.length)]
}

/** Pause courte en secondes : 0,30 s au niveau 1, jusqu’à 0,20 s au niveau 5. */
export const shortGap = (level: number): number => 0.3 - 0.025 * (clampLevel(level) - 1)

/** Pause longue = 2,2 × la courte. */
export const LONG_RATIO = 2.2

/** Secondes depuis le premier coup (premier = 0) pour chaque coup du motif. */
export const toOffsets = (gaps: Gap[], level: number): number[] => {
  const s = shortGap(level)
  const out = [0]
  for (const g of gaps) out.push(out[out.length - 1] + (g === 'long' ? s * LONG_RATIO : s))
  return out
}

/**
 * Détermine quelles pauses mesurées sont longues et lesquelles sont courtes.
 *
 * Le problème : la personne tape sur un pavé tactile ou avec un doigt, donc les durées sont imprécises. Une pause
 * voulue « court » peut durer de 250 à 380 ms, et une « long » peut sortir entre ~1,6 × et ~3 × les courtes. Aucun
 * seuil fixe en millisecondes ne fonctionne : il faut déduire le tempo de la personne à partir des tapes elles-mêmes
 * (p. ex. par rapport aux pauses les plus courtes/médianes), et quand toutes les pauses se ressemblent, elles sont toutes « court ».
 *
 * @param gaps pauses mesurées en millisecondes entre des tapes consécutives (longueur = tapes - 1)
 * @returns un Gap par pause en entrée, dans le même ordre
 */
export const classifyGaps = (gaps: number[]): Gap[] => {
  // Deux groupes (courts / longs) : on coupe au plus grand saut de ratio entre pauses triées.
  // Plus robuste qu'un repère sur la seule plus petite pause, qu'un coup trop rapide fausserait.
  const sorted = [...gaps].sort((a, b) => a - b)
  let cut = 0
  let jump = 1
  for (let i = 0; i < sorted.length - 1; i++) {
    const r = sorted[i + 1] / Math.max(sorted[i], 1)
    if (r > jump) [jump, cut] = [r, i]
  }
  // Saut trop faible : tout se ressemble, donc tout est « court ».
  if (jump < 1.3) return gaps.map(() => 'court')
  // Seuil au milieu géométrique du saut.
  const threshold = Math.sqrt(sorted[cut] * sorted[cut + 1])
  return gaps.map((g) => (g >= threshold ? 'long' : 'court'))
}

/** Résultat d’un essai : juste, trop peu de tapes, trop de tapes, ou bon nombre mais mauvais rythme. */
export type Verdict = 'ok' | 'trop-peu' | 'trop' | 'rythme'

/** Compare les tapes de la personne (ms, valeurs de performance.now) au motif de la voyante. */
export const judge = (pattern: Gap[], tapTimes: number[]): Verdict => {
  const expected = pattern.length + 1
  if (tapTimes.length < expected) return 'trop-peu'
  if (tapTimes.length > expected) return 'trop'
  const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i])
  const got = classifyGaps(intervals)
  return got.every((g, i) => g === pattern[i]) ? 'ok' : 'rythme'
}
