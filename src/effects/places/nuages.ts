import type { RaymarchState } from '../raymarch'
import nuagesShader from './nuages.wgsl'
import type { PlaceConfig } from './types'

/** Paramètres des nuages : flottement très lent de la caméra, vent des nuages (`drift`), variante (lune de sang, aube). */
const nuagesParams = (s: RaymarchState & { variant?: Record<string, number> }): Record<string, number> => {
  const { t, paranoia: p, motion: m } = s
  const speed = 0.09 / (1 + 0.6 * p)
  return {
    time: t,
    width: s.width,
    height: s.height,
    paranoia: p,
    sway: m ? 0.02 * Math.sin(t * speed) : 0,
    swayY: m ? 0.01 * Math.sin(t * speed * 1.3 + 1) : 0,
    drift: s.drift,
    px: s.px,
    py: s.py,
    blood: s.variant?.blood ?? 0,
    dawn: s.variant?.dawn ?? 0,
  }
}

export const nuages: PlaceConfig = { shader: nuagesShader, params: nuagesParams, ambience: 'nuages' }
