import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bumpVisits, levelForVisits, readVisits, resetVisits } from '../../src/../src/composables/useVisits'

describe('resetVisits', () => {
  beforeEach(() => {
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    })
  })

  it('brings the counter back to 0 and the level to 1, leaving other keys alone', () => {
    localStorage.setItem('rvj-bags', 'keep')
    for (let i = 0; i < 20; i++) bumpVisits()
    expect(levelForVisits(readVisits())).toBe(5)
    resetVisits()
    expect(readVisits()).toBe(0)
    expect(levelForVisits(readVisits())).toBe(1)
    expect(localStorage.getItem('rvj-bags')).toBe('keep')
  })
})
