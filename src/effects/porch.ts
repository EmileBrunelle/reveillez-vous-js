import porchShader from './porch.wgsl'
import type { RaymarchState } from './raymarch'

export { porchShader }

/** Paramètres propres au perron : balancement de caméra (amplitude croît avec la paranoïa, rythme ralentit) et loup-garou. */
export const porchParams = (s: RaymarchState): Record<string, number> => {
  const { t, paranoia: p } = s
  const m = s.motion
  const k = 1 + 1.2 * p // uneasy: amplitude grows ...
  const speed = 0.13 / (1 + 0.8 * p) // ... while the rhythm slows
  return {
    time: t,
    width: s.width,
    height: s.height,
    paranoia: p,
    sway: m ? 0.02 * k * Math.sin(t * speed) + 0.008 * k * Math.sin(t * speed * 2.3 + 1) : 0,
    swayY: m ? 0.008 * k * Math.sin(t * speed * 1.4 + 2) : 0,
    drift: s.drift,
    wolf: Math.min(1, Math.max(0, (p - 0.62) / 0.16)),
    px: s.px,
    py: s.py,
  }
}
