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

/** Progression de capture : monte quand le pointeur est assez près, redescend (à `decay` fois la vitesse de montée) sinon. Bornée à [0, 1]. */
export const stepCatch = (progress: number, near: boolean, dt: number, holdSeconds = 1, decay = 0.5) => {
  const next = progress + (near ? dt / holdSeconds : (-dt / holdSeconds) * decay)
  return Math.min(1, Math.max(0, next))
}

export const isNear = (p: Vec, q: Vec, radius: number) => Math.hypot(p.x - q.x, p.y - q.y) <= radius

/** Réglages d’un feu follet selon le niveau de vigilance (1–5) et la taille de la scène. */
export interface WispTuning {
  radius: number // rayon de capture (px)
  hold: number // secondes de proximité cumulées pour capturer
  decay: number // vitesse de redescente de la progression, relative à la montée
  stiffness: number
  damping: number
  hopMin: number // délai entre deux nouvelles cibles (s)
  hopSpan: number
  calmRange: number // sous cette distance au pointeur, le feu hésite
  calmFactor: number // facteur de vitesse pendant l’hésitation
  margin: number
}

/** Réglages de référence : ~6–10 s pour les trois feux, plus docile au niveau 2 et un peu plus vif au niveau 5. */
export const wispTuning = (level: number, w: number, h: number): WispTuning => {
  const lvl = Math.min(5, Math.max(1, Math.round(level)))
  const f = 1 + (Math.max(2, lvl) - 3) * 0.06 // 0,94 (niv. 1–2) … 1,12 (niv. 5)
  const radius = Math.min(96, Math.max(72, Math.min(w, h) * 0.11))
  return {
    radius,
    hold: (0.6 / (lvl >= 5 ? 1.05 : 1)) * (lvl <= 2 ? 0.95 : 1),
    decay: 0.25,
    stiffness: 14 * f * f,
    damping: 5 * f,
    hopMin: 0.9 / f,
    hopSpan: 0.8 / f,
    calmRange: radius * 1.6,
    calmFactor: 0.3,
    margin: 56,
  }
}

export interface WispState {
  pos: Vec
  vel: Vec
  target: Vec
  untilHop: number
}

/**
 * Un pas du feu follet : ressort vers la cible, nouvelle cible à intervalle, et hésitation quand le
 * pointeur s’approche (le temps du feu s’écoule à `calmFactor`, avec une rampe douce jusqu’à 2 × `calmRange`).
 * Le résultat reste dans les marges de la scène (la vitesse est annulée contre un bord).
 */
export const stepWisp = (s: WispState, pointer: Vec | null, dt: number, rng: Rng, w: number, h: number, t: WispTuning): WispState => {
  let slow = 1
  if (pointer) {
    const d = Math.hypot(pointer.x - s.pos.x, pointer.y - s.pos.y)
    if (d <= t.calmRange) slow = t.calmFactor
    else if (d < t.calmRange * 2) slow = t.calmFactor + ((1 - t.calmFactor) * (d - t.calmRange)) / t.calmRange
  }
  const sdt = Math.min(dt, 1 / 30) * slow
  let target = s.target
  let untilHop = s.untilHop - sdt
  if (untilHop <= 0) {
    target = nextWaypoint(rng, w, h, s.pos, t.margin)
    untilHop = t.hopMin + rng() * t.hopSpan
  }
  const sx = stepSpring(s.pos.x, s.vel.x, target.x, sdt, t.stiffness, t.damping)
  const sy = stepSpring(s.pos.y, s.vel.y, target.y, sdt, t.stiffness, t.damping)
  const loX = Math.min(t.margin, w / 2)
  const hiX = Math.max(w - t.margin, w / 2)
  const loY = Math.min(t.margin, h / 2)
  const hiY = Math.max(h - t.margin, h / 2)
  const x = Math.min(hiX, Math.max(loX, sx.pos))
  const y = Math.min(hiY, Math.max(loY, sy.pos))
  return { pos: { x, y }, vel: { x: x === sx.pos ? sx.vel : 0, y: y === sy.pos ? sy.vel : 0 }, target, untilHop }
}
