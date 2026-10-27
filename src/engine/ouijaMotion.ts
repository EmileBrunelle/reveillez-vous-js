/** Mouvement de la goutte (pur, testable) : inclinaison et lift selon la vitesse, « autres mains » et résistance à la dérive. */

export const TILT_MAX = 9 // degrés
export const LIFT_MAX = 1.04 // échelle max à pleine vitesse
const TILT_K = 0.9 // degrés par unité de vitesse (px par image à 60 Hz)
const SPEED_FULL = 14 // vitesse (px/image) qui donne le lift complet
export const WANDER_MAX = 2 // px
export const TREMOR_MAX = 1.5 // px
export const TREMOR_HZ = 1.6 // ≤ 2 Hz

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** Inclinaison (deg) : la goutte se penche dans le sens du mouvement horizontal, bornée à ±9°. `resist` (0–1) ajoute une inclinaison contre le sens de la dérive. */
export const tiltFromVelocity = (vx: number, resist = 0) => clamp(vx * TILT_K - Math.sign(vx) * resist * 3, -TILT_MAX, TILT_MAX)

/** Échelle de lift : 1 à l’arrêt, jusqu’à 1,04 à vitesse élevée. */
export const liftFromSpeed = (vx: number, vy: number) => 1 + (LIFT_MAX - 1) * clamp(Math.hypot(vx, vy) / SPEED_FULL, 0, 1)

/** Amplitude (px) du vagabondage des « autres mains » : 0,5 px au niveau 1, 2 px au niveau 5. */
export const wanderAmp = (level: number) => 0.5 + ((clamp(Math.round(level), 1, 5) - 1) / 4) * (WANDER_MAX - 0.5)

/** Décalage Lissajous lent (< 0,5 Hz) ajouté au rendu seulement ; `t` en ms. */
export const wanderOffset = (t: number, level: number) => {
  const a = wanderAmp(level)
  const s = t / 1000
  return { x: a * Math.sin(2 * Math.PI * 0.23 * s), y: a * Math.sin(2 * Math.PI * 0.37 * s + 1.1) }
}

/** Tremblement basse fréquence de position pendant la dérive résistée ; `strength` 0–1. */
export const tremorOffset = (t: number, strength: number) => {
  const a = TREMOR_MAX * clamp(strength, 0, 1)
  const s = t / 1000
  return { x: a * Math.sin(2 * Math.PI * TREMOR_HZ * s), y: a * Math.sin(2 * Math.PI * TREMOR_HZ * 0.75 * s + 0.7) }
}

/** Rapproche `cur` de `goal` (lissage exponentiel indépendant du pas de temps) : retour doux au repos. */
export const approach = (cur: number, goal: number, dtMs: number, tauMs: number) => goal + (cur - goal) * Math.exp(-dtMs / tauMs)
