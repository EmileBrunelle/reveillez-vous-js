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
    useEventListener: (type: string, fn: () => void) => void h.listeners.set(type, fn),
  }
})

import { ac } from '../../src/audio/sfx'

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

describe('reprise du contexte audio', () => {
  it('au retour de visibilité, un contexte interrompu est repris', async () => {
    c.state = 'interrupted'
    h.visibility.value = 'hidden'
    await nextTick()
    expect(c.resume).not.toHaveBeenCalled()
    h.visibility.value = 'visible'
    await nextTick()
    expect(c.resume).toHaveBeenCalledTimes(1)
  })
  it('au prochain toucher, un contexte suspendu est repris', () => {
    c.state = 'suspended'
    h.listeners.get('pointerdown')?.()
    expect(c.resume).toHaveBeenCalledTimes(1)
  })
  it('un contexte qui tourne n’est pas repris', () => {
    h.listeners.get('pointerdown')?.()
    expect(c.resume).not.toHaveBeenCalled()
  })
})
