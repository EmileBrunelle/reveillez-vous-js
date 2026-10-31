import { describe, expect, it } from 'vitest'
import { prophecies } from '../../src/content/prophecies'
import { SECHE_CHANCE, nextProphecy, secheFor, templatesFor } from '../../src/engine/prophecy'
import { mulberry32 } from '../../src/engine/rng'

const memStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('prophéties sèches', () => {
  it('existent à chaque niveau, au moins 2 par niveau, 8 à 10 au total', () => {
    let total = 0
    for (const n of [1, 2, 3, 4, 5] as const) {
      const t = secheFor(prophecies, n)
      expect(t.length, `seche${n}`).toBeGreaterThanOrEqual(2)
      total += t.length
    }
    expect(total).toBeGreaterThanOrEqual(8)
    expect(total).toBeLessThanOrEqual(10)
  })

  it('sont rares : la chance est d’environ 1 sur 8, et la fréquence observée aussi', () => {
    expect(SECHE_CHANCE).toBeGreaterThan(0.1)
    expect(SECHE_CHANCE).toBeLessThanOrEqual(0.15)
    for (const n of [1, 3, 5] as const) {
      const starts = secheFor(prophecies, n).map((t) => t.corps.split('{')[0].slice(0, 25))
      const rng = mulberry32(n * 7)
      const store = memStore()
      let hits = 0
      const runs = 2000
      for (let i = 0; i < runs; i++) {
        const body = nextProphecy(prophecies, n, store, rng).body
        if (starts.some((s) => body.startsWith(s))) hits++
      }
      expect(hits / runs, `niveau ${n}`).toBeGreaterThan(0.08)
      expect(hits / runs, `niveau ${n}`).toBeLessThan(0.18)
      expect(templatesFor(prophecies, n).length).toBeGreaterThan(secheFor(prophecies, n).length * 4)
    }
  })

  it('sont au futur : pas de passé composé, pas de « date », au moins trois phrases', () => {
    for (const n of [1, 2, 3, 4, 5] as const) {
      for (const t of secheFor(prophecies, n)) {
        const body = t.corps
        expect(body, body).not.toMatch(/\b(avez|ont|avons) (été|eu|fait|mort)\b/i)
        expect(body).not.toMatch(/\bdate\b/i)
        expect(body.split(/[.!?:]\s/).length).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
