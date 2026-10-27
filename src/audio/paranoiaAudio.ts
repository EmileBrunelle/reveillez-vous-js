import type { ParanoiaLevel } from '../engine/paranoia'
import { MASTER_GAIN } from './ambienceSynth'

/** Fondamentale de la basse fantôme (Hz) : écouteurs seulement, les petits haut-parleurs ne la rendent pas. */
export const SUB_HZ = 41

/**
 * Basse fantôme : fondamentale + harmoniques 2 à 5 (82, 123, 164, 205 Hz) d’amplitude décroissante.
 * Les petits haut-parleurs rendent les harmoniques et l’oreille reconstruit la fondamentale absente.
 */
export const BASS_PARTIALS: readonly (readonly [hz: number, amp: number])[] = [
  [SUB_HZ, 1],
  [SUB_HZ * 2, 0.8],
  [SUB_HZ * 3, 0.6],
  [SUB_HZ * 4, 0.45],
  [SUB_HZ * 5, 0.3],
]

/**
 * Nappe tonale sombre dans le médium (220–311 Hz) : seconde mineure (220 / 233,1), triton (311,1) et une voix
 * désaccordée de 0,4 Hz (battement lent, < 1 Hz). Chaque voix enfle seule sur `period` secondes (≥ 9 s).
 */
export const PAD_VOICES: readonly { hz: number; amp: number; period: number }[] = [
  { hz: 220, amp: 1, period: 11 },
  { hz: 233.1, amp: 0.8, period: 14 },
  { hz: 311.1, amp: 0.7, period: 9 },
  { hz: 220.4, amp: 0.7, period: 12 },
]
/** Profondeur de l’enflure : le gain d’une voix oscille entre 1 - PAD_DEPTH et 1 + PAD_DEPTH fois sa valeur moyenne. */
export const PAD_DEPTH = 0.4

/** RMS (gain unitaire) de chaque couche : somme de sinus, (Σ a²/2)^½ ; la nappe est pondérée par la puissance moyenne de l’enflure. */
export const BASS_UNIT_RMS = Math.sqrt(BASS_PARTIALS.reduce((a, [, amp]) => a + (amp * amp) / 2, 0))
export const PAD_UNIT_RMS = Math.sqrt(PAD_VOICES.reduce((a, v) => a + (v.amp * v.amp) / 2, 0) * (1 + (PAD_DEPTH * PAD_DEPTH) / 2))

/** Niveau RMS visé au bus maître (dBFS) pour l’ensemble basse + nappe, par niveau de paranoïa ; rien au niveau 1. */
export const TARGET_DBFS: Record<ParanoiaLevel, number> = { 1: -Infinity, 2: -37, 3: -30, 4: -26, 5: -22 }
/** Part de la puissance : la nappe médium porte plus (c’est elle qu’on entend sur un portable). */
const BASS_POWER_SHARE = 0.45

const gainFor = (level: ParanoiaLevel, share: number, unitRms: number) => {
  const rms = 10 ** (TARGET_DBFS[level] / 20)
  return Math.round(((Math.sqrt(share) * rms) / (MASTER_GAIN * unitRms)) * 100) / 100
}
const table = (share: number, unit: number): Record<ParanoiaLevel, number> => ({
  1: 0,
  2: gainFor(2, share, unit),
  3: gainFor(3, share, unit),
  4: gainFor(4, share, unit),
  5: gainFor(5, share, unit),
})
/** Gain de la basse fantôme avant le bus d’ambiance (> 1 : le bus ramène à ≈ -27 dBFS). */
export const SUB_GAINS: Record<ParanoiaLevel, number> = table(BASS_POWER_SHARE, BASS_UNIT_RMS)
/** Gain de la nappe médium, même principe. */
export const PAD_GAINS: Record<ParanoiaLevel, number> = table(1 - BASS_POWER_SHARE, PAD_UNIT_RMS)

/** RMS estimé (dBFS) de l’ensemble basse + nappe au bus maître (couches non corrélées : puissances additionnées). */
export const estimatedDbfs = (level: number) => {
  const l = clampLevel(level)
  const power = (SUB_GAINS[l] * BASS_UNIT_RMS) ** 2 + (PAD_GAINS[l] * PAD_UNIT_RMS) ** 2
  return power === 0 ? -Infinity : 20 * Math.log10(MASTER_GAIN * Math.sqrt(power))
}

export const clampLevel = (n: number): ParanoiaLevel => Math.min(5, Math.max(1, Math.round(Number.isFinite(n) ? n : 1))) as ParanoiaLevel

export const subGain = (level: number) => SUB_GAINS[clampLevel(level)]
export const padGain = (level: number) => PAD_GAINS[clampLevel(level)]

/** Gain du bus des sons rares (< 4 s, médium) : +≈ 10 dB, un coup de ≈ -18 dBFS crête, qui passe sur un portable sans faire sursauter. */
export const RARE_BOOST = 3

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

/** Avertissement rare (le motif « mystère » grave et lent) : jamais aux niveaux 1–2, au plus une fois par 60–90 s dès le niveau 3. */
export const WARNING_MIN_LEVEL = 3
export const WARNING_RANGE = { min: 60, max: 90 } as const
/** Pendant l’avertissement, la couche de paranoïa (basse + nappe) baisse d’environ 8 dB (rampe douce), puis remonte. */
export const WARNING_DUCK_DB = -8
export const WARNING_DUCK_DOWN = 0.4
export const WARNING_DUCK_UP = 1.5

export const warningAllowed = (level: number) => clampLevel(level) >= WARNING_MIN_LEVEL

/** Délai (s) avant le prochain avertissement, ou `null` aux niveaux 1–2. `rng` ∈ [0,1[ injectable. */
export const nextWarningDelay = (level: number, rng: () => number = Math.random): number | null => (warningAllowed(level) ? WARNING_RANGE.min + (WARNING_RANGE.max - WARNING_RANGE.min) * rng() : null)
