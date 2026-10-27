import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useGpuEffect } from '../../src/composables/useGpuEffect'
import type { GpuLoop } from '../../src/effects/gpuLoop'

// useTimeoutFn de VueUse ne démarre que si `window` et `document` existent à l’import (isClient) : l’environnement de test est node.
vi.hoisted(() => {
  Object.assign(globalThis, { window: globalThis, document: { createElement: () => ({}) } })
})
const canvas = ref({} as HTMLCanvasElement)
const settle = () => Promise.resolve()
const loop = () => ({ stop: vi.fn<() => void>() })
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}
const visible = ref('visible')
const mount = (start: Parameters<typeof useGpuEffect>[1], options: Parameters<typeof useGpuEffect>[2] = {}) => {
  const scope = effectScope()
  const fx = scope.run(() => useGpuEffect(canvas, start, { settle, warning: 'test', visibility: visible, ...options }))!
  return { scope, ...fx }
}

describe('useGpuEffect', () => {
  beforeEach(() => {
    visible.value = 'visible'
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => vi.useRealTimers())

  it('démarre au montage, passe à ready et arrête la boucle à la destruction du scope', async () => {
    const l = loop()
    const start = vi.fn(async () => l)
    const { scope, status } = mount(start)
    expect(status.value).toBe('starting')
    await flush()
    expect(start).toHaveBeenCalledWith(canvas.value, expect.any(Function))
    expect(status.value).toBe('ready')
    expect(l.stop).not.toHaveBeenCalled()
    scope.stop()
    expect(l.stop).toHaveBeenCalledOnce()
  })

  it('démontage pendant l’init asynchrone : la boucle tardive est arrêtée aussitôt', async () => {
    const l = loop()
    let resolve!: (v: GpuLoop) => void
    const { scope, status } = mount(() => new Promise<GpuLoop>((r) => (resolve = r)))
    await flush()
    scope.stop()
    resolve(l)
    await flush()
    expect(l.stop).toHaveBeenCalledOnce()
    expect(status.value).toBe('starting')
  })

  it('démontage avant la fin de l’attente de mise en page : rien n’est démarré', async () => {
    const start = vi.fn(async () => loop())
    let release!: () => void
    const { scope } = mount(start, { settle: () => new Promise<void>((r) => (release = r)) })
    await flush() // la visibilité est déjà acquise : `settle` est en attente
    scope.stop()
    release()
    await flush()
    expect(start).not.toHaveBeenCalled()
  })

  it('échec de l’init : failed, lost, avertissement', async () => {
    const { status, lost } = mount(async () => {
      throw new Error('boom')
    })
    await flush()
    expect(status.value).toBe('failed')
    expect(lost.value).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })

  it('perte du périphérique : onLost passe lost à vrai', async () => {
    let onLost = () => {}
    const { lost } = mount(async (_c, cb) => ((onLost = cb), loop()))
    await flush()
    expect(lost.value).toBe(false)
    onLost()
    expect(lost.value).toBe(true)
  })

  it('porte refusée : unavailable, start jamais appelé', async () => {
    const start = vi.fn(async () => loop())
    const { status } = mount(start, { gate: async () => false })
    await flush()
    expect(status.value).toBe('unavailable')
    expect(start).not.toHaveBeenCalled()
  })

  it('init qui dépasse le délai : failed, puis la boucle tardive est libérée', async () => {
    vi.useFakeTimers()
    const l = loop()
    let resolve!: (v: GpuLoop) => void
    const { status, lost } = mount(() => new Promise<GpuLoop>((r) => (resolve = r)), { timeout: 5000 })
    await vi.advanceTimersByTimeAsync(5001)
    expect(status.value).toBe('failed')
    expect(lost.value).toBe(true)
    resolve(l)
    await vi.advanceTimersByTimeAsync(0)
    expect(l.stop).toHaveBeenCalledOnce()
  })

  it('attente de mise en page qui ne se résout jamais (onglet masqué) : failed après le délai', async () => {
    vi.useFakeTimers()
    const start = vi.fn(async () => loop())
    const { status } = mount(start, { timeout: 5000, settle: () => new Promise<void>(() => {}) })
    await vi.advanceTimersByTimeAsync(5001)
    expect(status.value).toBe('failed')
    expect(start).not.toHaveBeenCalled()
  })

  it('rejette une Error à l’expiration et ne laisse aucune minuterie après un succès', async () => {
    vi.useFakeTimers()
    mount(async () => loop(), { timeout: 5000 })
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
    const { status } = mount(() => new Promise<GpuLoop>(() => {}), { timeout: 100 })
    await vi.advanceTimersByTimeAsync(101)
    expect(status.value).toBe('failed')
    expect(vi.mocked(console.warn).mock.calls.at(-1)?.[1]).toBeInstanceOf(Error)
  })

  it('document caché : ni start ni échec, même après le délai ; visible : démarrage normal', async () => {
    vi.useFakeTimers()
    visible.value = 'hidden'
    const l = loop()
    const start = vi.fn(async () => l)
    const { status, lost } = mount(start, { timeout: 5000, gate: async () => true })
    await vi.advanceTimersByTimeAsync(20000)
    expect(start).not.toHaveBeenCalled()
    expect(status.value).toBe('starting')
    expect(lost.value).toBe(false)
    visible.value = 'visible'
    await vi.advanceTimersByTimeAsync(0)
    expect(start).toHaveBeenCalledOnce()
    expect(status.value).toBe('ready')
  })

  it('visible mais attente bloquée : le délai court à partir de la visibilité, puis start n’est jamais lancé', async () => {
    vi.useFakeTimers()
    visible.value = 'hidden'
    let release!: () => void
    const start = vi.fn(async () => loop())
    const { status } = mount(start, { timeout: 5000, settle: () => new Promise<void>((r) => (release = r)) })
    await vi.advanceTimersByTimeAsync(10000)
    visible.value = 'visible'
    await vi.advanceTimersByTimeAsync(4000)
    expect(status.value).toBe('starting')
    await vi.advanceTimersByTimeAsync(1100)
    expect(status.value).toBe('failed')
    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(start).not.toHaveBeenCalled() // expiré : pas de start inutile
  })

  it('destruction pendant l’attente de visibilité : rien ne démarre au retour', async () => {
    visible.value = 'hidden'
    const start = vi.fn(async () => loop())
    const { scope } = mount(start)
    scope.stop()
    visible.value = 'visible'
    await flush()
    expect(start).not.toHaveBeenCalled()
  })
})
