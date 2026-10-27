import { describe, expect, it } from 'vitest'
import { isQuickKnock, paranoiaLevel } from '../../src/engine/paranoia'

describe('paranoiaLevel', () => {
  it('returns an integer 1..5 for 0..100 and never decreases', () => {
    let prev = 0
    for (let v = 0; v <= 100; v++) {
      const l = paranoiaLevel(v)
      expect([1, 2, 3, 4, 5]).toContain(l)
      expect(l).toBeGreaterThanOrEqual(prev)
      prev = l
    }
  })

  it('escalates slowly: level 2 at 2 visits, level 5 at 7', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(paranoiaLevel)).toEqual([1, 1, 2, 3, 3, 4, 4, 5, 5])
  })
})

describe('isQuickKnock', () => {
  it('level 1 second visit (knocked) still gets the full ritual (quick=false)', () => {
    expect(isQuickKnock(true, paranoiaLevel(1))).toBe(false)
  })
  it('level 2+ with knocked gets quick=true', () => {
    for (const v of [2, 3, 5, 7]) expect(isQuickKnock(true, paranoiaLevel(v))).toBe(true)
  })
  it('never quick before the first knock', () => {
    for (const v of [0, 2, 7]) expect(isQuickKnock(false, paranoiaLevel(v))).toBe(false)
  })
})
