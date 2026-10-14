import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { doors, pickDoor, pickPlaceVariant, placeForLevel, places, type Place } from '../../src/content/scenes'
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

describe('doors', () => {
  it('each place has exactly one primary door', () => {
    places.forEach((p) => expect(doors.filter((d) => d.place === p.id)).toHaveLength(1))
  })
  it('keeps frigo and garde-robe as place-less humorous variants', () => {
    expect(
      doors
        .filter((d) => !d.place)
        .map((d) => d.id)
        .sort(),
    ).toEqual(['frigo', 'garde-robe'])
  })
  it('door ids are unique', () => {
    expect(new Set(doors.map((d) => d.id)).size).toBe(doors.length)
  })
  it.each(places.map((p) => p.id))('%s: primary door most of the time, only humorous variants otherwise', (id) => {
    const picks = Array.from({ length: 1000 }, (_, s) => pickDoor(id, mulberry32(s)))
    picks.forEach((d) => expect(!d.place || d.place === id).toBe(true))
    const primary = picks.filter((d) => d.place === id).length
    expect(primary).toBeGreaterThan(780)
    expect(primary).toBeLessThan(1000)
  })
  it('door SVGs keep a door-handle for the knock animation and the shared viewBox', () => {
    readdirSync('src/assets/svg')
      .filter((f) => f.startsWith('porte-'))
      .forEach((f) => {
        const svg = readFileSync(`src/assets/svg/${f}`, 'utf8')
        expect(svg, f).toContain('class="door-handle"')
        expect(svg, f).toContain('viewBox="0 0 120 190"')
      })
  })
})
