import type { ParanoiaLevel } from '../engine/paranoia'

/** Gain du sous-bourdon (relatif au bus d’ambiance, déjà à ≈ -27 dBFS) par niveau de paranoïa 1..5 : absent au niveau 1, puis par paliers. */
export const SUB_GAINS: Record<ParanoiaLevel, number> = { 1: 0, 2: 0.12, 3: 0.2, 4: 0.3, 5: 0.42 }

/** Fréquence du sous-bourdon (Hz) : sinus pur, aucun battement (une seule fondamentale + une octave). */
export const SUB_HZ = 41

export const clampLevel = (n: number): ParanoiaLevel => Math.min(5, Math.max(1, Math.round(Number.isFinite(n) ? n : 1))) as ParanoiaLevel

export const subGain = (level: number) => SUB_GAINS[clampLevel(level)]

export type RareKind = 'thud' | 'breath' | 'crackle'
export const RARE_KINDS: readonly RareKind[] = ['thud', 'breath', 'crackle']

/** Plage d’attente (s) entre deux sons « qui ne vont pas » ; `null` avant le niveau 3. */
export const RARE_RANGES: Record<ParanoiaLevel, { min: number; max: number } | null> = {
  1: null,
  2: null,
  3: { min: 40, max: 60 },
  4: { min: 30, max: 50 },
  5: { min: 20, max: 35 },
}

export const rareRange = (level: number) => RARE_RANGES[clampLevel(level)]

/** Délai (s) avant le prochain son rare, ou `null` s’il n’y en a pas à ce niveau. `rng` ∈ [0,1[ injectable. */
export const nextRareDelay = (level: number, rng: () => number = Math.random): number | null => {
  const r = rareRange(level)
  return r ? r.min + (r.max - r.min) * rng() : null
}

/** Choisit un son rare ; évite de répéter le précédent. */
export const pickRareKind = (previous: RareKind | null, rng: () => number = Math.random): RareKind => {
  const pool = RARE_KINDS.filter((k) => k !== previous)
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]
}
