import { describe, expect, it } from 'vitest'
import { knockPlan } from './knock'

describe('knockPlan', () => {
  it('scales count 3..7 and tightens spacing with level', () => {
    const counts = [1, 2, 3, 4, 5].map((l) => knockPlan(l).offsets.length)
    expect(counts).toEqual([3, 4, 5, 6, 7])
    const gap = (l: number) => {
      const o = knockPlan(l).offsets
      return o[1] - o[0]
    }
    expect(gap(1)).toBeCloseTo(0.3)
    expect(gap(5)).toBeCloseTo(0.14)
  })
  it('has strictly increasing times, intensity 0..1, and clamps the level', () => {
    for (let l = 1; l <= 5; l++) {
      const p = knockPlan(l)
      expect(p.offsets[0]).toBeCloseTo(0.1)
      p.offsets.slice(1).forEach((t, i) => expect(t).toBeGreaterThan(p.offsets[i]))
    }
    expect(knockPlan(1).intensity).toBe(0)
    expect(knockPlan(5).intensity).toBe(1)
    expect(knockPlan(99).offsets.length).toBe(7)
    expect(knockPlan(-3).offsets.length).toBe(3)
  })
})
