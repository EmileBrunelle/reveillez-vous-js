import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../src/engine/rng'
import { pickVariant } from '../../src/engine/variant'

describe('pickVariant weight', () => {
  it('favors heavier variants', () => {
    const w = [
      { id: 'a', minLevel: 1, weight: 9 },
      { id: 'b', minLevel: 1 },
    ]
    const n = Array.from({ length: 400 }, (_, s) => pickVariant(w, 1, null, mulberry32(s)).id).filter((id) => id === 'a').length
    expect(n).toBeGreaterThan(320)
  })
})
