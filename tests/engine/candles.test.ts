import { describe, expect, it } from 'vitest'
import { advanceHold, HOLD_MS, isNearWick, pickSnuffed } from '../../src/engine/candles'
import { mulberry32 } from '../../src/engine/rng'

describe('candles', () => {
  it('allume après HOLD_MS de contact', () => {
    let p = 0
    for (let t = 0; t < HOLD_MS; t += 100) p = advanceHold(p, true, 100)
    expect(p).toBeCloseTo(1, 6)
  })
  it('retombe sans contact, sans passer sous 0', () => {
    expect(advanceHold(0.5, false, 100)).toBeLessThan(0.5)
    expect(advanceHold(0.01, false, 1000)).toBe(0)
  })
  it('détecte la proximité', () => {
    expect(isNearWick(0, 0, 3, 4, 5)).toBe(true)
    expect(isNearWick(0, 0, 3, 4, 4.9)).toBe(false)
  })
  it('ne choisit qu’une chandelle allumée', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 20; i++) expect([0, 2]).toContain(pickSnuffed([true, false, true], rng))
    expect(pickSnuffed([false, false, false], rng)).toBe(-1)
  })
})
