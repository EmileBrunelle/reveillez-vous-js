import { readFileSync } from 'node:fs'
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
  it.each(['foret', 'cimetiere', 'rue', 'nuages'] as const)('%s has at least 2 variants with unique ids', (id) => {
    const ids = places.find((x) => x.id === id)!.variants.map((v) => v.id)
    expect(ids.length).toBeGreaterThanOrEqual(2)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it.each(['foret', 'cimetiere', 'rue', 'nuages'] as const)('%s variants share the same param keys, all declared in the WGSL Params struct', (id) => {
    const variants = places.find((x) => x.id === id)!.variants
    const keys = Object.keys(variants[0].params ?? {}).sort()
    expect(keys.length).toBeGreaterThan(0)
    variants.forEach((v) => expect(Object.keys(v.params ?? {}).sort()).toEqual(keys))
    const src = readFileSync(`src/effects/places/${id}.wgsl`, 'utf8')
    const struct = /struct Params \{([^}]*)\}/.exec(src)![1]
    keys.forEach((k) => expect(struct).toMatch(new RegExp(`\\b${k}:`)))
  })
  it('never picks a zero-weight variant while others exist (aube is finale-only)', () => {
    const nuages = places.find((x) => x.id === 'nuages')!
    expect(nuages.variants.find((v) => v.id === 'aube')?.weight).toBe(0)
    for (let s = 0; s < 300; s++) {
      expect(pickPlaceVariant(nuages, null, mulberry32(s)).id).not.toBe('aube')
      expect(pickPlaceVariant(nuages, 'pale', mulberry32(s)).id).not.toBe('aube')
      expect(pickPlaceVariant(nuages, 'sang', mulberry32(s)).id).not.toBe('aube')
    }
  })
  it('picks a variant of the place, favoring heavier ones and avoiding the last when possible', () => {
    const p: Place = { id: 'perron', level: 1, variants: [{ id: 'a', weight: 9 }, { id: 'b' }] }
    const n = Array.from({ length: 400 }, (_, s) => pickPlaceVariant(p, null, mulberry32(s)).id).filter((id) => id === 'a').length
    expect(n).toBeGreaterThan(320)
    expect(pickPlaceVariant(p, 'a', mulberry32(3)).id).toBe('b')
    expect(pickPlaceVariant(placeForLevel(1), 'defaut', mulberry32(3)).id).toBe('defaut')
  })
})
