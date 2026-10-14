import { describe, expect, it } from 'vitest'
import { pickPlaceVariant, placeForLevel, places, type Place } from '../../src/content/scenes'
import { mulberry32 } from '../../src/engine/rng'

describe('places', () => {
  it('one place per level, in order', () => {
    expect([1, 2, 3, 4, 5].map((l) => placeForLevel(l).id)).toEqual(['perron', 'foret', 'cimetiere', 'rue', 'nuages'])
  })
  it('every place has at least one variant', () => {
    places.forEach((p) => expect(p.variants.length).toBeGreaterThan(0))
  })
  it('picks a variant of the place, favoring heavier ones and avoiding the last when possible', () => {
    const p: Place = { id: 'perron', level: 1, variants: [{ id: 'a', weight: 9 }, { id: 'b' }] }
    const n = Array.from({ length: 400 }, (_, s) => pickPlaceVariant(p, null, mulberry32(s)).id).filter((id) => id === 'a').length
    expect(n).toBeGreaterThan(320)
    expect(pickPlaceVariant(p, 'a', mulberry32(3)).id).toBe('b')
    expect(pickPlaceVariant(placeForLevel(1), 'defaut', mulberry32(3)).id).toBe('defaut')
  })
})
