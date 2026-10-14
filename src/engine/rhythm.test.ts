import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { classifyGaps, judge, rhythmFor, toOffsets, type Gap } from './rhythm'

const taps = (intervals: number[], start = 1000) => intervals.reduce((a, d) => [...a, a[a.length - 1] + d], [start])

describe('rhythmFor', () => {
  const RANGES: Record<number, [number, number]> = { 1: [3, 4], 2: [4, 4], 3: [4, 5], 4: [5, 5], 5: [5, 6] }
  const MIN_DISTINCT: Record<number, number> = { 1: 4, 2: 3, 3: 6, 4: 5, 5: 10 }
  const run = (l: number, seed: number) => rhythmFor(l, mulberry32(seed))

  it('knock count stays in the per-level range (both ends reached), clamping the level', () => {
    for (let l = 1; l <= 5; l++) {
      const [lo, hi] = RANGES[l]
      const counts = new Set<number>()
      for (let seed = 0; seed < 200; seed++) counts.add(run(l, seed).length + 1)
      expect(Math.min(...counts)).toBe(lo)
      expect(Math.max(...counts)).toBe(hi)
    }
    for (let seed = 0; seed < 50; seed++) {
      expect(run(99, seed).length + 1).toBeGreaterThanOrEqual(5)
      expect(run(-3, seed).length + 1).toBeLessThanOrEqual(4)
    }
  })
  it('has both gap kinds and never two long in a row (many seeds)', () => {
    for (let l = 1; l <= 5; l++) {
      for (let seed = 0; seed < 200; seed++) {
        const g = run(l, seed)
        expect(g).toContain('long')
        expect(g).toContain('court')
        g.slice(1).forEach((x, i) => expect(x === 'long' && g[i] === 'long').toBe(false))
      }
    }
  })
  it('does not always start with a short gap', () => {
    const firsts = new Set(Array.from({ length: 200 }, (_, s) => run(1, s)[0]))
    expect(firsts).toEqual(new Set(['court', 'long']))
  })
  it('is deterministic given the rng', () => {
    for (let l = 1; l <= 5; l++) expect(run(l, 7)).toEqual(run(l, 7))
  })
  it('has real variety at every level', () => {
    for (let l = 1; l <= 5; l++) {
      const seen = new Set(Array.from({ length: 200 }, (_, s) => run(l, s).join()))
      expect(seen.size).toBeGreaterThanOrEqual(MIN_DISTINCT[l])
    }
  })
})

describe('toOffsets', () => {
  const g: Gap[] = ['court', 'long', 'court']
  it('starts at 0, is strictly increasing, one offset per knock', () => {
    for (let l = 1; l <= 5; l++) {
      const o = toOffsets(g, l)
      expect(o).toHaveLength(4)
      expect(o[0]).toBe(0)
      o.slice(1).forEach((t, i) => expect(t).toBeGreaterThan(o[i]))
    }
  })
  it('short ≈ 0.30 s at L1, ≈ 0.20 s at L5, long = 2.2× short', () => {
    const o1 = toOffsets(g, 1)
    const o5 = toOffsets(g, 5)
    expect(o1[1]).toBeCloseTo(0.3)
    expect(o5[1]).toBeCloseTo(0.2)
    expect((o1[2] - o1[1]) / (o1[1] - o1[0])).toBeCloseTo(2.2)
  })
})

describe('judge (counts)', () => {
  const p: Gap[] = ['court', 'long']
  it('too few / too many taps', () => {
    expect(judge(p, [0, 300])).toBe('trop-peu')
    expect(judge(p, [])).toBe('trop-peu')
    expect(judge(p, [0, 300, 900, 1200])).toBe('trop')
  })
})

describe('classifyGaps', () => {
  it('stays fair when one short gap is much faster than the others', () => {
    expect(classifyGaps([200, 310, 560, 290])).toEqual(['court', 'court', 'long', 'court'])
  })

  it('clean pattern', () => {
    expect(classifyGaps([300, 300, 700])).toEqual(['court', 'court', 'long'])
  })
  it('human jitter', () => {
    expect(classifyGaps([280, 340, 650, 310])).toEqual(['court', 'court', 'long', 'court'])
  })
  it('sloppy but clear long (ratio ~1.7)', () => {
    expect(classifyGaps([300, 510, 290])).toEqual(['court', 'long', 'court'])
  })
  it('all similar gaps are all short', () => {
    expect(classifyGaps([300, 320, 290])).toEqual(['court', 'court', 'court'])
  })
  it('works at a slower tempo', () => {
    expect(classifyGaps([500, 1100, 480])).toEqual(['court', 'long', 'court'])
  })
  it('judge ok end-to-end', () => {
    expect(judge(['court', 'court', 'long', 'court'], taps([280, 340, 650, 310]))).toBe('ok')
  })
  it('judge rythme when the long is misplaced', () => {
    expect(judge(['court', 'long', 'court'], taps([300, 300, 700]))).toBe('rythme')
  })
  it('judge rythme when a long was played short', () => {
    expect(judge(['court', 'long'], taps([300, 310]))).toBe('rythme')
  })
})
