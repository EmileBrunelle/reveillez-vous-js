import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTO_RELOAD_WINDOW_MS, tryAutoReload } from '@/composables/chunkReload'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

const holds = () => true

afterEach(() => vi.unstubAllGlobals())

describe('tryAutoReload', () => {
  it('en ligne, premier échec : recharge une fois', () => {
    const reload = vi.fn()
    expect(tryAutoReload({ storage: memory(), now: 1_000_000, online: true, reload, holds })).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
  })
  it('un second échec dans la minute ne recharge pas (pas de boucle) ; après la fenêtre, oui', () => {
    const storage = memory()
    const reload = vi.fn()
    tryAutoReload({ storage, now: 1_000_000, online: true, reload, holds })
    expect(tryAutoReload({ storage, now: 1_000_000 + AUTO_RELOAD_WINDOW_MS - 1, online: true, reload, holds })).toBe(false)
    expect(tryAutoReload({ storage, now: 1_000_000 + AUTO_RELOAD_WINDOW_MS, online: true, reload, holds })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
  it('hors ligne : jamais de rechargement, le repli s’affiche', () => {
    const reload = vi.fn()
    expect(tryAutoReload({ storage: memory(), now: 1_000_000, online: false, reload, holds })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
  it('horodatage non persistant (sessionStorage inutilisable) : pas de rechargement, sinon boucle', () => {
    const reload = vi.fn()
    expect(tryAutoReload({ storage: memory(), now: 1_000_000, online: true, reload, holds: () => false })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
  it('par défaut, lit le vrai sessionStorage : absent ou en erreur, pas de rechargement', () => {
    const reload = vi.fn()
    vi.stubGlobal('sessionStorage', undefined)
    expect(tryAutoReload({ storage: memory(), now: 1_000_000, online: true, reload })).toBe(false)
    const real = new Map<string, string>()
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => real.get(k) ?? null })
    expect(tryAutoReload({ storage: memory(), now: 1_000_000, online: true, reload })).toBe(false)
    real.set('rvj-chunk-reload', '1000000')
    expect(tryAutoReload({ storage: memory(), now: 1_000_000 + AUTO_RELOAD_WINDOW_MS, online: true, reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
  it('par défaut, getItem du vrai sessionStorage qui lève : pas de rechargement', () => {
    const reload = vi.fn()
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('accès refusé')
      },
      setItem: () => {},
      removeItem: () => {},
    })
    expect(tryAutoReload({ storage: memory(), now: 1_000_000, online: true, reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
  it('par défaut, avec un sessionStorage complet : recharge une fois (chemin positif)', () => {
    const reload = vi.fn()
    const stockage = memory()
    vi.stubGlobal('sessionStorage', stockage)
    expect(tryAutoReload({ storage: stockage, now: 1_000_000, online: true, reload })).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
    expect(stockage.getItem('rvj-chunk-reload')).toBe('1000000')
  })
})
