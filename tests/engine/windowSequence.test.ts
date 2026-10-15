import { describe, expect, it } from 'vitest'
import { checkStep, hintFor, makeSequence, startInput } from '../../src/engine/windowSequence'
import { mulberry32 } from '../../src/engine/rng'

describe('makeSequence', () => {
  it('gives distinct windows in range, deterministic per seed', () => {
    for (let s = 0; s < 50; s++) {
      const seq = makeSequence(mulberry32(s))
      expect(seq).toHaveLength(3)
      expect(new Set(seq).size).toBe(3)
      seq.forEach((w) => expect(w >= 0 && w < 6).toBe(true))
      expect(makeSequence(mulberry32(s))).toEqual(seq)
    }
  })
})

describe('checkStep', () => {
  const seq = [4, 1, 2]
  it('advances then completes', () => {
    let r = checkStep(seq, startInput(), 4)
    expect(r.result).toBe('ok')
    r = checkStep(seq, r.state, 1)
    expect(r.result).toBe('ok')
    r = checkStep(seq, r.state, 2)
    expect(r.result).toBe('done')
  })
  it('resets to start on error and counts misses', () => {
    const r = checkStep(seq, { step: 2, misses: 0 }, 0)
    expect(r.result).toBe('wrong')
    expect(r.state).toEqual({ step: 0, misses: 1 })
  })
})

describe('hintFor', () => {
  it('shows the expected window only after 2 misses', () => {
    expect(hintFor([3, 0, 5], { step: 1, misses: 1 })).toBeNull()
    expect(hintFor([3, 0, 5], { step: 1, misses: 2 })).toBe(0)
  })
})
