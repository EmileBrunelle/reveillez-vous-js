import { afterEach, describe, expect, it } from 'vitest'
import { resetSafeStorageCache, safeSessionStorage, safeStorage } from '../../src/composables/safeStorage'

describe('safeStorage', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage
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
      value: {
        getItem: () => null,
        removeItem: () => {},
        setItem: () => {
          throw new Error('quota')
        },
      },
    })
    const s = safeStorage()
    s.setItem('a', '1')
    expect(s.getItem('a')).toBe('1')
  })

  it('uses the real storage when it works', () => {
    const m = new Map<string, string>()
    const real = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: real })
    safeStorage().setItem('k', 'v')
    expect(m.get('k')).toBe('v')
    expect(safeStorage().getItem('k')).toBe('v')
  })

  it('session variant falls back to its own memory when sessionStorage throws', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    })
    const s = safeSessionStorage()
    s.setItem('sk', 'v')
    expect(safeSessionStorage().getItem('sk')).toBe('v')
    expect(safeStorage().getItem('sk')).toBeNull()
  })

  it('session variant uses the real sessionStorage when it works', () => {
    const m = new Map<string, string>()
    const real = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: real })
    safeSessionStorage().setItem('k', 'v')
    expect(m.get('k')).toBe('v')
  })

  it('ne sonde le stockage qu’une fois (clé sonde écrite puis supprimée une seule fois)', () => {
    const calls = { set: 0, remove: 0 }
    const real = { getItem: () => null, setItem: () => void calls.set++, removeItem: () => void calls.remove++ }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: real })
    safeStorage()
    safeStorage()
    safeStorage()
    expect(calls).toEqual({ set: 1, remove: 1 })
  })

  it('quota plein après la sonde : l’écriture bascule vers la Map au lieu de lever', () => {
    let full = false
    const m = new Map<string, string>()
    const real = {
      getItem: (k: string) => m.get(k) ?? null,
      removeItem: (k: string) => void m.delete(k),
      setItem: (k: string, v: string) => {
        if (full) throw new DOMException('quota', 'QuotaExceededError')
        m.set(k, v)
      },
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: real })
    const s = safeStorage() // la sonde réussit : le verdict est « utilisable »
    s.setItem('avant', '1')
    full = true
    expect(() => s.setItem('apres', '2')).not.toThrow()
    expect(s.getItem('apres')).toBe('2')
    expect(s.getItem('avant')).toBe('1')
    s.removeItem('apres')
    expect(s.getItem('apres')).toBeNull()
  })

  it('resetSafeStorageCache vide aussi les Maps de repli', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    })
    safeStorage().setItem('k', 'v')
    resetSafeStorageCache()
    expect(safeStorage().getItem('k')).toBeNull()
  })
})
