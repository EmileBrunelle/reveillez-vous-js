import { describe, expect, it } from 'vitest'
import { knockIntensity } from './knock'

describe('knockIntensity', () => {
  it('goes from 0 at level 1 to 1 at level 5, increasing', () => {
    const v = [1, 2, 3, 4, 5].map(knockIntensity)
    expect(v[0]).toBe(0)
    expect(v[4]).toBe(1)
    v.slice(1).forEach((x, i) => expect(x).toBeGreaterThan(v[i]))
  })
  it('clamps the level', () => {
    expect(knockIntensity(99)).toBe(1)
    expect(knockIntensity(-3)).toBe(0)
  })
})
