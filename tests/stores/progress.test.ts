import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { arcaneIndex, MEMORY_KEY, useProgressStore, VISITS_KEY } from '../../src/stores/progress'
import { BAGS_KEY } from '../../src/engine/shuffleBag'

const m = new Map<string, string>()
const fresh = () => {
  setActivePinia(createPinia())
  return useProgressStore()
}

describe('progress store', () => {
  beforeEach(() => {
    m.clear()
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) })
  })

  it('starts at level 1 with default memory', () => {
    const s = fresh()
    expect(s.visits).toBe(0)
    expect(s.level).toBe(1)
    expect(s.paranoia).toBe(0)
    expect(s.memory).toEqual({ lastArcane: null, lastNom: null, lastLevel: null, finished: false })
  })

  it('reads the legacy plain-number visits format and keeps writing it', () => {
    m.set(VISITS_KEY, '20')
    const s = fresh()
    expect(s.level).toBe(5)
    expect(s.paranoia).toBe(1)
    s.bump()
    expect(m.get(VISITS_KEY)).toBe('21')
  })

  it.each(['abc', '-3', '1.5', '', '{"a":1}'])('falls back to 0 visits on garbage %j', (raw) => {
    m.set(VISITS_KEY, raw)
    expect(fresh().visits).toBe(0)
  })

  it.each(['{not json', 'null', '42', '"x"', '[]'])('falls back to default memory on garbage %j', (raw) => {
    m.set(MEMORY_KEY, raw)
    expect(fresh().memory).toEqual({ lastArcane: null, lastNom: null, lastLevel: null, finished: false })
  })

  it('merges partial or mistyped memory with defaults', () => {
    m.set(MEMORY_KEY, JSON.stringify({ lastArcane: 'x', lastNom: 42, lastLevel: 3, finished: 'yes' }))
    expect(fresh().memory).toEqual({ lastArcane: null, lastNom: null, lastLevel: 3, finished: false })
  })

  it('bump increments and returns the new count; reset only clears visits', () => {
    const s = fresh()
    expect(s.bump()).toBe(1)
    s.remember('XVII', 2)
    s.finish()
    m.set(BAGS_KEY, 'keep')
    for (let i = 0; i < 19; i++) s.bump()
    expect(s.level).toBe(5)
    s.reset()
    expect(s.level).toBe(1)
    expect(m.get(VISITS_KEY)).toBe('0')
    expect(m.get(BAGS_KEY)).toBe('keep')
    expect(s.memory).toEqual({ lastArcane: 17, lastNom: null, lastLevel: 2, finished: true })
  })

  it('remember and finish persist to rvj-memory', () => {
    const s = fresh()
    s.remember('0', 1)
    expect(JSON.parse(m.get(MEMORY_KEY)!)).toEqual({ lastArcane: 0, lastNom: null, lastLevel: 1, finished: false })
    s.finish()
    expect(fresh().memory.finished).toBe(true)
  })

  it('arcaneIndex parses roman numerals', () => {
    expect(['0', 'I', 'IV', 'IX', 'XVI', 'XVIII', 'XXI', 'XIII bis', 'XIII ½', 'LXVI', '?'].map(arcaneIndex)).toEqual([0, 1, 4, 9, 16, 18, 21, 13, 13, 66, null])
  })
})
