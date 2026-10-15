import { describe, expect, it } from 'vitest'
import { mulberry32, orSecure } from '../../src/engine/rng'

describe('orSecure', () => {
  it('sans Rng injecté, retourne un vrai Rng (nombres dans [0, 1), pas une fonction)', () => {
    const rng = orSecure(undefined)
    for (let i = 0; i < 50; i++) {
      const n = rng()
      expect(typeof n).toBe('number')
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })
  it('garde le Rng injecté tel quel', () => {
    const r = mulberry32(1)
    expect(orSecure(r)).toBe(r)
  })
})
