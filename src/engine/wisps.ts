import type { Rng } from './rng'

export interface Vec {
  x: number
  y: number
}

/** Une dimension de ressort amorti (Euler semi-implicite, pas borné pour rester stable). */
export const stepSpring = (pos: number, vel: number, target: number, dt: number, stiffness: number, damping: number) => {
  const h = Math.min(dt, 1 / 30)
  const v = vel + ((target - pos) * stiffness - vel * damping) * h
  return { pos: pos + v * h, vel: v }
}

/** Point d’errance aléatoire dans la scène, loin du précédent pour que le feu follet voyage vraiment. */
export const nextWaypoint = (rng: Rng, w: number, h: number, from: Vec, margin = 56, minDist = 120): Vec => {
  const spanX = Math.max(1, w - margin * 2)
  const spanY = Math.max(1, h - margin * 2)
  const draw = (): Vec => ({ x: margin + rng() * spanX, y: margin + rng() * spanY })
  const need = Math.min(minDist, Math.max(w, h) / 3)
  let p = draw()
  for (let i = 0; i < 6 && Math.hypot(p.x - from.x, p.y - from.y) < need; i++) p = draw()
  return p
}

/** Progression de capture : monte quand le pointeur est assez près, redescend (plus lentement) sinon. Bornée à [0, 1]. */
export const stepCatch = (progress: number, near: boolean, dt: number, holdSeconds = 1) => {
  const next = progress + (near ? dt / holdSeconds : (-dt / holdSeconds) * 0.5)
  return Math.min(1, Math.max(0, next))
}

export const isNear = (p: Vec, q: Vec, radius: number) => Math.hypot(p.x - q.x, p.y - q.y) <= radius
