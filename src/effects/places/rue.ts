import type { RaymarchState } from '../raymarch'
import rueShader from './rue.wgsl'
import type { PlaceConfig } from './types'

/** Horloge des fenêtres en mouvement réduit : image figée avec une vingtaine de fenêtres allumées. */
const STATIC_TIME = 70

/** Paramètres de la rue : balancement de caméra lent, horloge des fenêtres, variante (météo, part de fenêtres froides). */
const rueParams = (s: RaymarchState & { variant?: Record<string, number> }): Record<string, number> => {
  const { t, paranoia: p, motion: m } = s
  const speed = 0.11 / (1 + 0.8 * p)
  const k = 1 + p
  return {
    time: m ? t : STATIC_TIME,
    width: s.width,
    height: s.height,
    paranoia: p,
    sway: m ? 0.012 * k * Math.sin(t * speed) : 0,
    swayY: m ? 0.005 * k * Math.sin(t * speed * 1.4 + 2) : 0,
    drift: s.drift,
    px: s.px,
    py: s.py,
    weather: s.variant?.weather ?? 0,
    cold: s.variant?.cold ?? 0.2,
  }
}

export const rue: PlaceConfig = { shader: rueShader, params: rueParams, ambience: 'rue' }
