import type { Rng } from './rng'

// Durée pendant laquelle la flamme doit rester sur une mèche pour l’allumer.
export const HOLD_MS = 600

// Progression d’allumage d’une mèche (0 à 1) : monte pendant le contact, retombe plus vite sinon.
export const advanceHold = (progress: number, touching: boolean, dtMs: number, holdMs = HOLD_MS) => {
  const next = touching ? progress + dtMs / holdMs : progress - (dtMs / holdMs) * 2
  return Math.min(1, Math.max(0, next))
}

// Flamme à portée de la mèche (distance contre un rayon).
export const isNearWick = (fx: number, fy: number, wx: number, wy: number, radius: number) => (fx - wx) ** 2 + (fy - wy) ** 2 <= radius ** 2

// Chandelle à éteindre une seule fois (niveau 3) : tirée au hasard parmi les allumées non protégées
// (survolée, focalisée ou tenue au doigt), -1 s’il n’y en a pas.
export const pickSnuffed = (lit: boolean[], rng: Rng, excluded: ReadonlySet<number> = new Set()) => {
  const idx = lit.flatMap((on, i) => (on && !excluded.has(i) ? [i] : []))
  return idx.length ? idx[Math.floor(rng() * idx.length)] : -1
}
