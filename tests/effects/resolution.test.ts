import { describe, expect, it } from 'vitest'
import { placeDpr, SHARP_MAX_PIXELS } from '../../src/effects/resolution'

describe('placeDpr', () => {
  it('sous CRT : 0,5 plafonné à 540 px de côté long', () => {
    expect(placeDpr(800, 600, false, 2)).toBe(0.5)
    expect(placeDpr(2000, 788, false, 1)).toBeCloseTo(0.27)
  })
  it('CRT éteint : 1 × DPR, plafonné en pixels', () => {
    expect(placeDpr(2000, 788, true, 1)).toBe(1)
    const d = placeDpr(2000, 788, true, 3)
    expect(2000 * 788 * d * d).toBeLessThanOrEqual(SHARP_MAX_PIXELS + 1)
    expect(placeDpr(3840, 2160, true, 1)).toBeLessThan(1)
  })
  it('jamais sous le rendu CRT, DPR invalide toléré', () => {
    expect(placeDpr(384, 832, true, 0.5)).toBe(1)
    expect(placeDpr(384, 832, true, NaN)).toBe(1)
  })
})
