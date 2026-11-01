import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

// VueUse n’a pas de fenêtre en environnement node : on capte ce que sfx.ts lui demande d’observer.
const h = vi.hoisted(() => ({ visibility: { value: 'visible' } as { value: string }, listeners: new Map<string, () => void>() }))
vi.mock('@vueuse/core', async (importOriginal) => {
  const { ref } = await import('vue')
  const original = await importOriginal<typeof import('@vueuse/core')>()
  h.visibility = ref('visible')
  return {
    ...original,
    useDocumentVisibility: () => h.visibility,
    useTimeoutFn: (cb: () => void, ms: number) => {
      let id: ReturnType<typeof setTimeout> | undefined
      return { start: () => void (id = setTimeout(cb, ms)), stop: () => clearTimeout(id) }
    },
    useEventListener: (types: string | string[], fn: () => void) => void [types].flat().forEach((t) => h.listeners.set(t, fn)),
  }
})

class FakeCtx {
  state = 'running'
  currentTime = 1
  destination = {}
  resume = vi.fn(() => Promise.resolve())
  suspend = vi.fn(() => Promise.resolve())
  createGain = () => ({ gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: (n: unknown) => n })
  createDynamicsCompressor = () => ({ threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect: (n: unknown) => n })
}

let c: FakeCtx
let unlock: () => void
// Modules neufs à chaque test : le contexte et le drapeau « geste déjà fait » sont des singletons de module.
beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  h.listeners.clear()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
  vi.stubGlobal('window', { AudioContext: FakeCtx })
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
  const sfx = await import('@/audio/sfx')
  unlock = sfx.unlock
  h.visibility.value = 'visible'
  c = sfx.ac() as unknown as FakeCtx
  c.resume.mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('reprise du contexte audio', () => {
  it('avant tout geste, le retour de visibilité ne reprend pas le contexte (avertissement d’autoplay)', async () => {
    c.state = 'suspended'
    h.visibility.value = 'hidden'
    await nextTick()
    h.visibility.value = 'visible'
    await nextTick()
    expect(c.resume).not.toHaveBeenCalled()
  })
  it('un geste (pointerup ou keydown) reprend un contexte suspendu', () => {
    for (const type of ['pointerup', 'keydown']) {
      c.state = 'suspended'
      c.resume.mockClear()
      h.listeners.get(type)?.()
      expect(c.resume).toHaveBeenCalledTimes(1)
    }
    expect(h.listeners.has('pointerdown')).toBe(false)
  })
  it('après un geste, le retour de visibilité reprend un contexte interrompu', async () => {
    unlock()
    c.resume.mockClear()
    c.state = 'interrupted'
    h.visibility.value = 'hidden'
    await nextTick()
    expect(c.resume).not.toHaveBeenCalled()
    h.visibility.value = 'visible'
    await nextTick()
    expect(c.resume).toHaveBeenCalledTimes(1)
  })
  it('un contexte qui tourne n’est pas repris', () => {
    h.listeners.get('pointerup')?.()
    expect(c.resume).not.toHaveBeenCalled()
  })
  it('un contexte fermé est ignoré', async () => {
    c.state = 'closed'
    h.listeners.get('keydown')?.()
    h.visibility.value = 'hidden'
    await nextTick()
    h.visibility.value = 'visible'
    await nextTick()
    expect(c.resume).not.toHaveBeenCalled()
  })
})

describe('suspension du contexte (onglet caché)', () => {
  it('après un geste, suspend une fois les fondus finis, puis reprend une fois au retour', async () => {
    unlock()
    c.resume.mockClear()
    h.visibility.value = 'hidden'
    await nextTick()
    vi.advanceTimersByTime(300)
    expect(c.suspend).not.toHaveBeenCalled() // fondu de la musique encore en cours
    vi.advanceTimersByTime(1000)
    expect(c.suspend).toHaveBeenCalledTimes(1)
    c.state = 'suspended'
    h.visibility.value = 'visible'
    await nextTick()
    expect(c.resume).toHaveBeenCalledTimes(1)
    expect(c.suspend).toHaveBeenCalledTimes(1)
  })
  it('un retour avant la fin du délai annule la suspension', async () => {
    unlock()
    h.visibility.value = 'hidden'
    await nextTick()
    h.visibility.value = 'visible'
    await nextTick()
    vi.advanceTimersByTime(2000)
    expect(c.suspend).not.toHaveBeenCalled()
  })
  it('sans geste ou en sourdine, ne suspend pas', async () => {
    vi.stubGlobal('navigator', { userActivation: { hasBeenActive: false } })
    h.visibility.value = 'hidden'
    await nextTick()
    vi.advanceTimersByTime(2000)
    expect(c.suspend).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
