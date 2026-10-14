import cimetiereShader from './cimetiere.wgsl'
import type { PlaceConfig } from './types'

/** Cimetière de village : brouillard bas, pierres et croix, yeux dans la brume à haute paranoïa ; variantes (brume, lune, bruine) via `variant`. */
export const cimetiere: PlaceConfig = {
  shader: cimetiereShader,
  ambience: 'cimetiere',
  params: (s) => {
    const { t, paranoia: p } = s
    const k = 1 + 1.2 * p
    const speed = 0.13 / (1 + 0.8 * p)
    const m = s.motion
    const v = s.variant ?? {}
    return {
      time: t,
      width: s.width,
      height: s.height,
      paranoia: p,
      sway: m ? 0.02 * k * Math.sin(t * speed) + 0.008 * k * Math.sin(t * speed * 2.3 + 1) : 0,
      swayY: m ? 0.008 * k * Math.sin(t * speed * 1.4 + 2) : 0,
      drift: s.drift,
      eyes: Math.min(1, Math.max(0, (p - 0.45) / 0.45)),
      px: s.px,
      py: s.py,
      mist: v.mist ?? 1,
      moon: v.moon ?? 1,
      rain: v.rain ?? 0,
    }
  },
}
