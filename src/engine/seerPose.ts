import type { PlaceId } from '@/effects/places/types'

/**
 * Maths pures de la voyante (Seer.vue) : émergence, regard, transforms des groupes du SVG et teintes par lieu.
 * Tout est testable sans DOM ; Seer.vue ne fait qu’écrire ces valeurs dans les groupes.
 */

/** Demi-périodes des boucles lentes (secondes) : respiration ≈ 0,28 Hz, flamme ≈ 0,31 Hz, boule ≈ 0,23 Hz. Jamais plus de 0,5 Hz, jamais de clignotement. */
export const BREATH_HALF_S = 1.8
export const FLAME_HALF_S = 1.6
export const ORB_HALF_S = 2.2

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Rampe douce (smoothstep) de 0 à 1 entre `a` et `b` : chaque calque démarre son apparition à son propre moment de l’ouverture. */
export const ramp = (v: number, a: number, b: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export interface EmergePose {
  opacity: number
  /** Décalage vertical en % de la hauteur du personnage : elle vient du fond de l’embrasure. */
  y: number
  scale: number
}

/**
 * Émergence de l’ombre de l’embrasure selon la progression d’ouverture de la porte (0 → 1) : elle apparaît à peine la porte entrebâillée,
 * avance (échelle de profondeur 0,86 → 1) et monte légèrement. En mouvement réduit : fondu seul, sans déplacement.
 */
export const emergePose = (p: number, reduced = false): EmergePose =>
  reduced ? { opacity: ramp(p, 0, 1), y: 0, scale: 1 } : { opacity: ramp(p, 0.05, 0.5), y: (1 - ramp(p, 0, 0.95)) * 6, scale: 0.86 + 0.14 * ramp(p, 0, 0.95) }

/** Le liseré chaud du contre-jour s’allume quand la porte est déjà bien ouverte ; les yeux, en dernier. */
export const rimLevel = (p: number) => ramp(p, 0.3, 0.9)
export const eyesLevel = (p: number) => ramp(p, 0.65, 1)

/** Regard : position du pointeur par rapport au centre du personnage, ramenée à −1..1 sur la moitié de l’écran. */
export const gazeFrom = (px: number, py: number, cx: number, cy: number, vw: number, vh: number) => ({
  x: clamp((px - cx) / Math.max(1, vw / 2), -1, 1),
  y: clamp((py - cy) / Math.max(1, vh / 2), -1, 1),
})

/** Quand elle parle, elle se tourne vers la personne qui joue : le regard revient vers le centre (35 % de l’écart du pointeur). */
export const SPEAK_GAZE = 0.35

const n = (v: number) => Number(v.toFixed(3))

/** Respiration : le corps s’étire de 0,8 % au plus, ancré aux pieds (le bas du dessin ne bouge pas). `b` va de 0 à 1. */
export const bodyTransform = (b: number) => `translate(0 120) scale(1 ${n(1 + 0.008 * b)}) translate(0 -120)`
/** Tête : pivote sur le cou (41, 54), jusqu’à 3,2°, et s’incline d’un rien quand la main parle. `g` = geste 0..1. */
export const headTransform = (gx: number, gy: number, g: number) => `translate(0 ${n(gy * 0.6 + g * 0.7)}) rotate(${n(gx * 3.2)} 41 54)`
/** Yeux : glissent dans le vide du visage (±1,4 en x, ±0,7 en y). */
export const eyesTransform = (gx: number, gy: number) => `translate(${n(gx * 1.4)} ${n(gy * 0.7)})`
/** Main de la boule : lève et s’ouvre en pivotant sur le coude (66, 76). */
export const handBTransform = (g: number) => `translate(0 ${n(-2 * g)}) rotate(${n(12 * g)} 66 76)`
/** Bras de la bougie : à peine soulevé quand elle parle, la flamme monte avec lui. */
export const armATransform = (g: number) => `translate(0 ${n(-1.2 * g)})`

/** Niveaux de lueur (opacité) : bornés, faible amplitude. `f` et `o` vont de 0 à 1. */
export const flameLevel = (f: number) => n(0.86 + 0.14 * f)
export const orbLevel = (o: number) => n(0.84 + 0.16 * o)

export interface SeerTint {
  /** Liseré du contre-jour : la lueur de l’intérieur de la porte, légèrement teintée par le lieu. */
  rim: string
  /** Lumière du dehors sur le devant du manteau (lune, lampadaires). */
  moon: string
  /** Lueur de la boule de cristal. */
  orb: string
}
const NEUTRAL: SeerTint = { rim: '#ffd27a', moon: '#8fa4d8', orb: '#9ae0ff' }
export const SEER_TINTS: Record<PlaceId, SeerTint> = {
  perron: { rim: '#ffcf80', moon: '#93a6dc', orb: '#9ae0ff' },
  foret: { rim: '#ffd88a', moon: '#8aa2d6', orb: '#9ae0ff' },
  cimetiere: { rim: '#f2e0a0', moon: '#9fb6c8', orb: '#a8f0e0' },
  rue: { rim: '#ffb466', moon: '#b08a80', orb: '#9ae0ff' },
  nuages: { rim: '#ffd9b8', moon: '#b6a4d0', orb: '#b8e4ff' },
}
export const tintFor = (place?: PlaceId): SeerTint => (place ? SEER_TINTS[place] : NEUTRAL)
