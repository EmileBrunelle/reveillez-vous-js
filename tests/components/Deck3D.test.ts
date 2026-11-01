// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

// Le cycle GPU et la peinture du dos sont simulés : on récupère les rappels passés à createDeck3d.
const gpu = vi.hoisted(() => ({ opts: null as null | Record<string, unknown> }))
vi.mock('@/effects/deck3d', () => ({
  createDeck3d: vi.fn(async (_c: unknown, opts: Record<string, unknown>) => {
    gpu.opts = opts
    return { stop: vi.fn() }
  }),
}))
vi.mock('@/effects/deck3dBack', () => ({
  paintBack: vi.fn(async () => ({ width: 512, height: 878 })),
  mipChain: vi.fn((base: unknown, n: number) => Array.from({ length: n }, () => base)),
}))
const lostRef = vi.hoisted(() => ({ value: null as null | { value: boolean } }))
vi.mock('@/composables/useGpuEffect', async () => {
  const { ref } = await import('vue')
  return {
    useGpuEffect: (_c: unknown, start: (el: unknown, onLost: () => void) => Promise<unknown>) => {
      const lost = ref(false)
      lostRef.value = lost
      void start({}, () => (lost.value = true))
      return { status: ref('ready'), lost }
    },
  }
})

import Deck3D from '@/components/deck3d/Deck3D.vue'

type Opts = { params: (w: number, h: number) => Record<string, number>; dirty: () => boolean; drawn: () => void; back: () => readonly unknown[]; dpr: [number, number] }
const opts = () => gpu.opts as unknown as Opts
const settle = async () => {
  for (let i = 0; i < 4; i++) {
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
  }
}

describe('Deck3D', () => {
  setActivePinia(createPinia())

  it('canevas décoratif : aria-hidden, pas de pointeur', async () => {
    const w = mount(Deck3D, { props: { rx: 18, ry: -10, scale: 0.3 } })
    await settle()
    const c = w.find('canvas')
    expect(c.attributes('aria-hidden')).toBe('true')
    expect(c.classes()).toContain('pointer-events-none')
  })

  it('rendu à la demande : une image par changement de pose, rien au repos', async () => {
    const w = mount(Deck3D, { props: { rx: 18, ry: -10, scale: 0.3 } })
    await settle()
    expect(opts().back()).toHaveLength(10)
    expect(opts().params(280, 480).rx).toBeCloseTo((18 * Math.PI) / 180)
    opts().drawn()
    expect(opts().dirty()).toBe(false)
    await w.setProps({ rx: 20 })
    expect(opts().dirty()).toBe(true)
    expect(opts().params(280, 480).rx).toBeCloseTo((20 * Math.PI) / 180)
  })

  it('couvercle : le rang passe au shader', async () => {
    mount(Deck3D, { props: { rx: 18, ry: -10, scale: 0.3, coverSlot: 3 } })
    await settle()
    expect(opts().params(280, 480).cover).toBe(1)
  })

  it('GPU en échec : canevas masqué et `failed` émis (l’appelant garde le paquet CSS)', async () => {
    const w = mount(Deck3D, { props: { rx: 18, ry: -10, scale: 0.3 } })
    await settle()
    lostRef.value!.value = true
    await settle()
    expect(w.emitted('failed')).toHaveLength(1)
    expect(w.find('canvas').attributes('style')).toContain('display: none')
  })
})
