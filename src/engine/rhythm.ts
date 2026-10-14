import type { Rng } from './rng'

/** Pause between two knocks: short (« toc toc ») or long (« toc — toc »). */
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
 * Pattern the seer knocks: the pauses BETWEEN knocks (knocks = gaps.length + 1).
 * Knock count varies within a level; the pattern is drawn uniformly among the valid ones
 * (≥ 1 court — it gives the player's tempo —, ≥ 1 long, never two long in a row). Deterministic given `rng`.
 */
export const rhythmFor = (level: number, rng: Rng): Gap[] => {
  const counts = KNOCK_COUNTS[clampLevel(level)]
  const knocks = counts[Math.floor(rng() * counts.length)]
  const patterns = validPatterns(knocks - 1)
  return patterns[Math.floor(rng() * patterns.length)]
}

/** Short gap in seconds: 0.30 s at level 1 down to 0.20 s at level 5. */
export const shortGap = (level: number): number => 0.3 - 0.025 * (clampLevel(level) - 1)

/** Long gap = 2.2× the short one. */
export const LONG_RATIO = 2.2

/** Seconds from the first knock (first = 0) for each knock of the pattern. */
export const toOffsets = (gaps: Gap[], level: number): number[] => {
  const s = shortGap(level)
  const out = [0]
  for (const g of gaps) out.push(out[out.length - 1] + (g === 'long' ? s * LONG_RATIO : s))
  return out
}

/**
 * Decides which measured pauses are long and which are short.
 *
 * The problem: the player taps on a touchpad or a finger, so timings are imprecise. A pause meant as « court »
 * can be 250–380 ms, and a « long » one can come out anywhere from ~1.6× to ~3× the short ones. There is no
 * fixed millisecond threshold that works: the player's own tempo has to be inferred from the taps themselves
 * (e.g. relative to the shortest/median pauses), and when all pauses look alike they are all « court ».
 *
 * @param gaps measured pauses in milliseconds between consecutive taps (length = taps - 1)
 * @returns one Gap per input pause, same order
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

/** Outcome of an attempt: right, too few taps, too many taps, or right count but wrong rhythm. */
export type Verdict = 'ok' | 'trop-peu' | 'trop' | 'rythme'

/** Compares the player's taps (ms, performance.now values) with the seer's pattern. */
export const judge = (pattern: Gap[], tapTimes: number[]): Verdict => {
  const expected = pattern.length + 1
  if (tapTimes.length < expected) return 'trop-peu'
  if (tapTimes.length > expected) return 'trop'
  const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i])
  const got = classifyGaps(intervals)
  return got.every((g, i) => g === pattern[i]) ? 'ok' : 'rythme'
}
