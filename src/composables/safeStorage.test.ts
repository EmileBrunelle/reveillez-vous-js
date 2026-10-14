import { afterEach, describe, expect, it } from 'vitest'
import { safeStorage } from './safeStorage'

describe('safeStorage', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it('falls back to memory when reading localStorage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    })
    const s = safeStorage()
    expect(s.getItem('k')).toBeNull()
    s.setItem('k', 'v')
    expect(safeStorage().getItem('k')).toBe('v')
    s.removeItem('k')
    expect(s.getItem('k')).toBeNull()
  })

  it('falls back when setItem throws (quota / private mode)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, removeItem: () => {}, setItem: () => { throw new Error('quota') } },
    })
    const s = safeStorage()
    s.setItem('a', '1')
    expect(s.getItem('a')).toBe('1')
  })

  it('uses the real storage when it works', () => {
    const m = new Map<string, string>()
    const real = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: real })
    expect(safeStorage()).toBe(real)
  })
})
