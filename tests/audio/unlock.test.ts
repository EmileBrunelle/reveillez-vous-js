import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { shallowRef } from 'vue'

// Garde « aucun AudioContext avant le premier geste » : Chrome avertit à chaque création ou reprise sans activation.
const h = vi.hoisted(() => ({ listeners: new Map<string, () => void>() }))
vi.mock('@vueuse/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...original,
    // Une vraie `ref` : `watch` refuse une source qui n’est qu’un objet `{ value }`.
    useDocumentVisibility: () => shallowRef('visible'),
    useEventListener: (...a: unknown[]) => {
      const types = (typeof a[0] === 'string' || Array.isArray(a[0]) ? a[0] : a[1]) as string | string[]
      const fn = (typeof a[1] === 'function' ? a[1] : a[2]) as () => void
      for (const t of [types].flat()) h.listeners.set(t, fn)
    },
  }
})

const created = vi.hoisted(() => ({ n: 0 }))
class FakeCtx {
  state = 'running'
  currentTime = 0
  destination = {}
  constructor() {
    created.n++
  }
  resume = vi.fn(() => Promise.resolve())
  createGain = () => ({ gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: (n: unknown) => n })
  createDynamicsCompressor = () => ({ threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect: (n: unknown) => n })
}

const load = async (hasBeenActive: boolean) => {
  vi.resetModules()
  h.listeners.clear()
  created.n = 0
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
  vi.stubGlobal('window', { AudioContext: FakeCtx })
  vi.stubGlobal('navigator', { userActivation: { hasBeenActive } })
  setActivePinia(createPinia())
  return { sfx: await import('@/audio/sfx'), unlockMod: await import('@/audio/unlock') }
}
afterEach(() => vi.unstubAllGlobals())
beforeEach(() => vi.clearAllMocks())

describe('aucun AudioContext avant le premier geste', () => {
  it('ac() renvoie null et ne crée rien tant que la page n’est pas activée', async () => {
    const { sfx } = await load(false)
    expect(sfx.ac()).toBeNull()
    expect(sfx.ac()).toBeNull()
    expect(created.n).toBe(0)
  })

  it('unlock() (geste) déverrouille : un contexte est créé, une seule fois', async () => {
    const { sfx } = await load(false)
    sfx.unlock()
    const c = sfx.ac()
    expect(c).not.toBeNull()
    expect(sfx.ac()).toBe(c)
    expect(created.n).toBe(1)
  })

  it('une page déjà activée (navigator.userActivation) crée le contexte tout de suite', async () => {
    const { sfx } = await load(true)
    expect(sfx.ac()).not.toBeNull()
  })

  it('whenUnlocked : attend le premier geste, une seule fois, annulable', async () => {
    const { unlockMod } = await load(false)
    const start = vi.fn()
    const cancelled = vi.fn()
    unlockMod.whenUnlocked(start)
    const cancel = unlockMod.whenUnlocked(cancelled)
    cancel()
    expect(start).not.toHaveBeenCalled()
    h.listeners.get('pointerup')?.()
    expect(start).toHaveBeenCalledTimes(1)
    expect(cancelled).not.toHaveBeenCalled()
    h.listeners.get('keydown')?.()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('whenUnlocked : démarre tout de suite après un geste', async () => {
    const { unlockMod } = await load(true)
    const start = vi.fn()
    unlockMod.whenUnlocked(start)
    expect(start).toHaveBeenCalledTimes(1)
  })
})
