import { describe, expect, it } from 'vitest'
import { paranoiaLevel } from './paranoia'

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
})
