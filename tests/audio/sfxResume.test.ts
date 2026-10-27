import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
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
    useEventListener: (types: string | string[], fn: () => void) => void [types].flat().forEach((t) => h.listeners.set(t, fn)),
  }
})

import { ac, unlock } from '../../src/audio/sfx'

class FakeCtx {
  state = 'running'
  currentTime = 1
  destination = {}
  resume = vi.fn(() => Promise.resolve())
  createGain = () => ({ gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: (n: unknown) => n })
  createDynamicsCompressor = () => ({ threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect: (n: unknown) => n })
}

let c: FakeCtx
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
  vi.stubGlobal('window', { AudioContext: FakeCtx })
  setActivePinia(createPinia())
  h.visibility.value = 'visible'
  c = ac() as unknown as FakeCtx // le contexte du module survit d’un test à l’autre : on le remet à neuf
  c.state = 'running'
  c.resume.mockClear()
})
afterEach(() => vi.unstubAllGlobals())

// Le module garde son état d’un test à l’autre (contexte, « geste déjà fait ») : l’ordre des tests compte, « avant tout geste » d’abord.
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
