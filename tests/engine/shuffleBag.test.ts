import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../src/../src/engine/rng'
import { BAGS_KEY, draw, drawPersisted, type Bag } from '../../src/../src/engine/shuffleBag'

const memStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

const drawAll = (n: number, count: number, seed: number) => {
  const rng = mulberry32(seed)
  let bag: Bag | undefined
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const r = draw(bag, n, rng)
    out.push(r.index)
    bag = r.bag
  }
  return out
}

describe('shuffleBag', () => {
  it('uses every template once before any repeat', () => {
    const out = drawAll(7, 21, 3)
    for (let r = 0; r < 3; r++) expect(new Set(out.slice(r * 7, r * 7 + 7)).size).toBe(7)
  })

  it('is deterministic for a given rng seed', () => {
    expect(drawAll(6, 18, 42)).toEqual(drawAll(6, 18, 42))
    expect(drawAll(6, 18, 42)).not.toEqual(drawAll(6, 18, 43))
  })

  it('never repeats back-to-back across a reshuffle', () => {
    for (let s = 0; s < 50; s++) {
      const out = drawAll(3, 30, s)
      for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1])
    }
  })

  it('persisted bag survives a reload (no repeat) and resets on size change', () => {
    const store = memStore()
    const first = [0, 1, 2, 3, 4].map(() => drawPersisted(store, 'niveau1', 5, mulberry32(1)))
    // chaque appel utilisait un rng neuf à la même graine, mais le sac sauvegardé empêche les répétitions
    expect(new Set(first).size).toBe(5)
    expect(drawPersisted(store, 'niveau1', 8, mulberry32(1))).toBeLessThan(8)
  })

  it('survives corrupt storage', () => {
    const store = memStore()
    store.setItem(BAGS_KEY, '{not json')
    expect(drawPersisted(store, 'porte2', 4, mulberry32(1))).toBeLessThan(4)
  })

  it('remplace un tableau stocké par un objet, de sorte que l’état persiste', () => {
    const store = memStore()
    store.setItem(BAGS_KEY, '[]')
    drawPersisted(store, 'porte2', 4, mulberry32(1))
    const saved = JSON.parse(store.getItem(BAGS_KEY) ?? 'null')
    expect(Array.isArray(saved)).toBe(false)
    expect(saved.porte2.pos).toBe(1)
  })

  describe('allowed', () => {
    const isPerm = (b: Bag, n: number) => [...b.order].sort((a, c) => a - c).join() === Array.from({ length: n }, (_, i) => i).join()

    it('picks an allowed index, keeps a valid permutation and advances pos by 1', () => {
      for (let seed = 1; seed <= 40; seed++) {
        const rng = mulberry32(seed)
        const start = draw(undefined, 8, rng).bag
        const r = draw(start, 8, rng, (i) => i === 2 || i === 5)
        expect([2, 5]).toContain(r.index)
        expect(isPerm(r.bag, 8)).toBe(true)
        expect(r.bag.pos).toBe(start.pos + 1)
        expect(r.bag.order[start.pos]).toBe(r.index)
      }
    })

    it('keeps the no-repeat-within-round guarantee for later unfiltered draws', () => {
      for (let seed = 1; seed <= 40; seed++) {
        const rng = mulberry32(seed)
        let r = draw(undefined, 6, rng, (i) => i === 3)
        const seen = [r.index]
        for (let k = 1; k < 6; k++) {
          r = draw(r.bag, 6, rng)
          seen.push(r.index)
        }
        expect(new Set(seen).size).toBe(6)
      }
    })

    it('starts a new round when no allowed index remains in the bag', () => {
      const rng = mulberry32(7)
      let r = draw(undefined, 4, rng, (i) => i === 1)
      expect(r.index).toBe(1)
      r = draw(r.bag, 4, rng, (i) => i === 1)
      expect(r.index).toBe(1)
      expect(r.bag.pos).toBe(1)
      expect(isPerm(r.bag, 4)).toBe(true)
    })

    it('ignores the filter when no index is allowed at all', () => {
      const r = draw(undefined, 5, mulberry32(2), () => false)
      expect(r.index).toBeGreaterThanOrEqual(0)
      expect(r.index).toBeLessThan(5)
      expect(isPerm(r.bag, 5)).toBe(true)
      expect(r.bag.pos).toBe(1)
    })

    it('works through drawPersisted', () => {
      const store = memStore()
      for (let k = 0; k < 5; k++) expect([0, 4]).toContain(drawPersisted(store, 'x', 5, mulberry32(k + 1), (i) => i === 0 || i === 4))
    })
  })
})
