import { describe, expect, it } from 'vitest'
import { paranoiaLevel } from '../../src/../src/engine/paranoia'

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
