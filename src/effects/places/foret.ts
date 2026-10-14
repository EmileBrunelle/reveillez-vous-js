import foretShader from './foret.wgsl'
import type { PlaceConfig } from './types'

/** Forêt : balancement de caméra comme le perron, yeux dans le noir à haute paranoïa, variantes (brume, lune, neige) via `variant`. */
export const foret: PlaceConfig = {
  shader: foretShader,
  ambience: 'foret',
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
      snow: v.snow ?? 0,
      glow: 1,
    }
  },
}
