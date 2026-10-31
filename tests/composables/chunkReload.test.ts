import { describe, expect, it, vi } from 'vitest'
import { AUTO_RELOAD_WINDOW_MS, tryAutoReload } from '../../src/composables/chunkReload'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('tryAutoReload', () => {
  it('en ligne, premier échec : recharge une fois', () => {
    const reload = vi.fn()
    expect(tryAutoReload({ storage: memory(), now: 1_000_000, online: true, reload })).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
  })
  it('un second échec dans la minute ne recharge pas (pas de boucle) ; après la fenêtre, oui', () => {
    const storage = memory()
    const reload = vi.fn()
    tryAutoReload({ storage, now: 1_000_000, online: true, reload })
    expect(tryAutoReload({ storage, now: 1_000_000 + AUTO_RELOAD_WINDOW_MS - 1, online: true, reload })).toBe(false)
    expect(tryAutoReload({ storage, now: 1_000_000 + AUTO_RELOAD_WINDOW_MS, online: true, reload })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
  it('hors ligne : jamais de rechargement, le repli s’affiche', () => {
    const reload = vi.fn()
    expect(tryAutoReload({ storage: memory(), now: 1_000_000, online: false, reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
