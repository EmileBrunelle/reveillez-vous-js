import { describe, expect, it } from 'vitest'
import { prophecies } from '../../src/content/prophecies'
import { nextFakeError } from '../../src/engine/prophecy'
import { mulberry32 } from '../../src/engine/rng'
import type { Grammar } from '../../src/engine/grammar'
import { tableKey } from '../../src/content/prophecies'

const memStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('nextFakeError', () => {
  it('real content: at least 12 distinct errors per level 3..5, icons and buttons present', () => {
    for (const n of [3, 4, 5] as const) expect(new Set(prophecies[tableKey('erreur', n)].map((e) => JSON.stringify(e))).size, `erreur${n}`).toBeGreaterThanOrEqual(12)
    expect((prophecies.erreur_icone as string[]).length).toBeGreaterThanOrEqual(3)
    expect((prophecies.erreur_boutons as string[]).length).toBeGreaterThanOrEqual(5)
  })

  it('never repeats a message within a visit, even when the bag wraps (small pool, many seeds and visits)', () => {
    const g: Grammar = {
      erreur3: [
        { titre: 'A', texte: 'a' },
        { titre: 'B', texte: 'b' },
        { titre: 'C', texte: 'c' },
      ],
      erreur_icone: ['stop'],
      erreur_boutons: ['OK'],
    }
    for (let seed = 1; seed <= 60; seed++) {
      const store = memStore()
      const rng = mulberry32(seed)
      for (let visit = 0; visit < 12; visit++) {
        const seen = new Set<string>()
        const titles: string[] = []
        for (let k = 0; k < 3; k++) titles.push(nextFakeError(g, 3, store, rng, seen)!.title)
        expect(new Set(titles).size, `seed ${seed} visit ${visit}: ${titles}`).toBe(3)
      }
    }
  })

  it('returns null once every message of the visit was seen, or when the table is missing', () => {
    const g: Grammar = {
      erreur3: [
        { titre: 'A', texte: 'a' },
        { titre: 'B', texte: 'b' },
      ],
    }
    const seen = new Set<string>()
    const store = memStore()
    const rng = mulberry32(1)
    expect(nextFakeError(g, 3, store, rng, seen)).not.toBeNull()
    expect(nextFakeError(g, 3, store, rng, seen)).not.toBeNull()
    expect(nextFakeError(g, 3, store, rng, seen)).toBeNull()
    expect(nextFakeError({}, 3, store, rng, new Set())).toBeNull()
  })

  for (const level of [3, 4, 5] as const) {
    it(`real content level ${level}: the persisted bag cycles across visits (all messages seen before any comes back)`, () => {
      const size = prophecies[tableKey('erreur', level)].length
      const store = memStore()
      const rng = mulberry32(level)
      const titles: string[] = []
      for (let visit = 0; visit < size; visit++) titles.push(nextFakeError(prophecies, level, store, rng, new Set())!.title)
      expect(new Set(titles).size).toBe(size)
    })
  }

  it('structure: title, text, valid icon and 1 to 3 non-empty buttons', () => {
    const store = memStore()
    const rng = mulberry32(5)
    for (let i = 0; i < 80; i++) {
      const e = nextFakeError(prophecies, ([3, 4, 5] as const)[i % 3], store, rng, new Set())!
      expect(e.title.length).toBeGreaterThan(0)
      expect(e.text.length).toBeGreaterThan(0)
      expect(['stop', 'warn', 'info', 'question']).toContain(e.icon)
      expect(e.buttons.length).toBeGreaterThanOrEqual(1)
      expect(e.buttons.length).toBeLessThanOrEqual(3)
      for (const b of e.buttons) expect(b.trim()).not.toBe('')
    }
  })
})
