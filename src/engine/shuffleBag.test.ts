import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { draw, drawPersisted, type Bag } from './shuffleBag'

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
    // each call used a fresh rng seeded identically, yet the saved bag prevents repeats
    expect(new Set(first).size).toBe(5)
    expect(drawPersisted(store, 'niveau1', 8, mulberry32(1))).toBeLessThan(8)
  })

  it('survives corrupt storage', () => {
    const store = memStore()
    store.setItem('rvj-bags', '{not json')
    expect(drawPersisted(store, 'porte2', 4, mulberry32(1))).toBeLessThan(4)
  })
})
