import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { arcaneIndex, KNOCKED_KEY, MEMORY_KEY, useProgressStore, VISITS_KEY } from '../../src/stores/progress'
import { BAGS_KEY } from '../../src/engine/shuffleBag'

const m = new Map<string, string>()
const ss = new Map<string, string>()
const stub = (map: Map<string, string>) => ({ getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) })
const fresh = () => {
  setActivePinia(createPinia())
  return useProgressStore()
}

describe('progress store', () => {
  beforeEach(() => {
    m.clear()
    ss.clear()
    vi.stubGlobal('localStorage', stub(m))
    vi.stubGlobal('sessionStorage', stub(ss))
  })

  it('starts at level 1 with default memory', () => {
    const s = fresh()
    expect(s.visits).toBe(0)
    expect(s.level).toBe(1)
    expect(s.paranoia).toBe(0)
    expect(s.memory).toEqual({ lastArcane: null, lastNom: null, lastLevel: null, finished: false })
  })

  it('reads the plain-number visits format from sessionStorage and keeps writing it there', () => {
    ss.set(VISITS_KEY, '20')
    const s = fresh()
    expect(s.level).toBe(5)
    expect(s.paranoia).toBe(1)
    s.bump()
    expect(ss.get(VISITS_KEY)).toBe('21')
    expect(m.has(VISITS_KEY)).toBe(false)
  })

  it('migration: drops the old localStorage visits without importing them', () => {
    m.set(VISITS_KEY, '20')
    m.set(MEMORY_KEY, JSON.stringify({ lastArcane: 3, lastNom: null, lastLevel: 2, finished: true }))
    const s = fresh()
    expect(m.has(VISITS_KEY)).toBe(false)
    expect(s.level).toBe(1)
    expect(s.memory.finished).toBe(true)
  })

  it('progress does not survive a new session but memory does', () => {
    const s = fresh()
    s.bump()
    s.finish()
    ss.clear()
    const again = fresh()
    expect(again.visits).toBe(0)
    expect(again.memory.finished).toBe(true)
  })

  it.each(['abc', '-3', '1.5', '', '{"a":1}'])('falls back to 0 visits on garbage %j', (raw) => {
    ss.set(VISITS_KEY, raw)
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

  it('knocked: false at first, set by markKnocked in sessionStorage only, cleared by reset and completeFinale, gone with the session', () => {
    const s = fresh()
    expect(s.knocked).toBe(false)
    s.markKnocked()
    expect(s.knocked).toBe(true)
    expect(ss.get(KNOCKED_KEY)).toBe('1')
    expect(m.has(KNOCKED_KEY)).toBe(false)
    expect(fresh().knocked).toBe(true)
    s.reset()
    expect(s.knocked).toBe(false)
    s.markKnocked()
    s.completeFinale()
    expect(s.knocked).toBe(false)
    s.markKnocked()
    ss.clear()
    expect(fresh().knocked).toBe(false)
  })

  it.each(['abc', '', '2', 'true'])('knocked falls back to false on garbage %j', (raw) => {
    ss.set(KNOCKED_KEY, raw)
    expect(fresh().knocked).toBe(false)
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
    expect(ss.get(VISITS_KEY)).toBe('0')
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

  it('completeFinale zeroes visits and bags, keeps the memory and marks finished', () => {
    const s = fresh()
    s.remember('XVII', 2)
    for (let i = 0; i < 12; i++) s.bump()
    m.set(BAGS_KEY, '{"niveau3":{"order":[0],"pos":1}}')
    s.completeFinale()
    expect(s.visits).toBe(0)
    expect(s.level).toBe(1)
    expect(ss.get(VISITS_KEY)).toBe('0')
    expect(m.has(BAGS_KEY)).toBe(false)
    expect(s.memory).toEqual({ lastArcane: 17, lastNom: null, lastLevel: 2, finished: true })
    expect(fresh().memory.finished).toBe(true)
  })

  it('arcaneIndex parses roman numerals', () => {
    expect(['0', 'I', 'IV', 'IX', 'XVI', 'XVIII', 'XXI', 'XIII bis', 'XIII ½', 'LXVI', '?'].map(arcaneIndex)).toEqual([0, 1, 4, 9, 16, 18, 21, 13, 13, 66, null])
  })
})
