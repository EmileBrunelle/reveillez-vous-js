import type { Rng } from './rng'

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export const intersects = (a: Box, b: Box, margin = 0) => a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin

/**
 * Premier emplacement libre pour une fenêtre `w × h` parmi les coins et le milieu des bords de `area`,
 * essayés dans un ordre tiré au hasard ; aucun emplacement ne touche un rectangle de `avoid` (à `margin` près). null si tout est pris.
 */
export const pickFreeSlot = (area: Box, w: number, h: number, avoid: Box[], rng: Rng, margin = 12, gap = 16): { x: number; y: number } | null => {
  const xs = [area.left + gap, (area.left + area.right - w) / 2, area.right - w - gap]
  const ys = [area.top + gap, (area.top + area.bottom - h) / 2, area.bottom - h - gap]
  const slots = xs.flatMap((x) => ys.map((y) => ({ x, y }))).filter((s) => !(s.x === xs[1] && s.y === ys[1]))
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }
  const fits = (s: { x: number; y: number }) =>
    s.x >= area.left && s.y >= area.top && s.x + w <= area.right && s.y + h <= area.bottom && !avoid.some((b) => intersects({ left: s.x, top: s.y, right: s.x + w, bottom: s.y + h }, b, margin))
  return slots.find(fits) ?? null
}
