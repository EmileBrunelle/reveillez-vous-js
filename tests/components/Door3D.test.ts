// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

// Le cycle GPU est simulé : on récupère les rappels passés à createDoor3d pour lire `dirty` et l’angle envoyé au shader.
const gpu = vi.hoisted(() => ({ opts: null as null | Record<string, (...a: never[]) => unknown> }))
vi.mock('@/effects/door3d', () => ({
  createDoor3d: vi.fn(async (_c: unknown, opts: Record<string, (...a: never[]) => unknown>) => {
    gpu.opts = opts
    return { stop: vi.fn() }
  }),
}))
vi.mock('@/composables/useGpuEffect', async () => {
  const { ref } = await import('vue')
  return {
    useGpuEffect: (_c: unknown, start: (el: unknown, onLost: () => void) => Promise<unknown>) => {
      void start({}, () => {})
      return { status: ref('ready'), lost: ref(false) }
    },
  }
})

import Door3D from '@/components/doors3d/Door3D.vue'

type Opts = { params: (dt: number, w: number, h: number) => Record<string, number>; dirty: () => boolean; drawn: () => void }
const opts = () => gpu.opts as unknown as Opts
const settle = async () => {
  await nextTick()
  await new Promise((r) => setTimeout(r, 0))
}

describe('Door3D', () => {
  it('`ready` à la première image dessinée seulement (une fois) ; le canevas est invisible avant', async () => {
    const w = mount(Door3D, { props: { variant: 'perron' } })
    await settle()
    expect(w.emitted('ready')).toBeUndefined()
    expect(w.get('canvas').classes()).toContain('opacity-0')
    opts().drawn()
    opts().drawn()
    await nextTick()
    expect(w.emitted('ready')).toHaveLength(1)
    expect(w.get('canvas').classes()).toContain('opacity-100')
  })

  it('transmet le niveau de qualité à createDoor3d', async () => {
    mount(Door3D, { props: { variant: 'perron', quality: 'medium' } })
    await settle()
    expect((gpu.opts as unknown as { settled: string }).settled).toBe('medium')
  })

  it('canevas décoratif : aria-hidden, pas de pointeur', async () => {
    const w = mount(Door3D, { props: { variant: 'perron' } })
    await settle()
    const c = w.find('canvas')
    expect(c.attributes('aria-hidden')).toBe('true')
    expect(c.classes()).toContain('pointer-events-none')
  })

  it('props → uniformes : angle et matériau du lieu ; au repos, plus rien n’est dû', async () => {
    const w = mount(Door3D, { props: { variant: 'cimetiere', angle: 40 } })
    await settle()
    const p = opts().params(1 / 60, 300, 475)
    expect(p.angle).toBeCloseTo((40 * Math.PI) / 180)
    expect(p.style).toBe(2)
    opts().drawn()
    expect(opts().dirty()).toBe(false)
    await w.setProps({ angle: 60 })
    expect(opts().dirty()).toBe(true)
    expect(opts().params(1 / 60, 300, 475).angle).toBeCloseTo((60 * Math.PI) / 180)
  })

  it('un coup fait vibrer la porte jusqu’au repos, puis la boucle s’arrête ; rien en mouvement réduit', async () => {
    const w = mount(Door3D, { props: { variant: 'rue', knock: 0 } })
    await settle()
    opts().drawn()
    await w.setProps({ knock: 1 })
    expect(opts().dirty()).toBe(true)
    let moved = false
    for (let i = 0; i < 300 && opts().dirty(); i++) {
      if (opts().params(1 / 60, 300, 475).angle < 0) moved = true
      opts().drawn()
    }
    expect(moved).toBe(true)
    expect(opts().dirty()).toBe(false)

    await w.setProps({ reduced: true })
    opts().params(1 / 60, 300, 475)
    opts().drawn()
    await w.setProps({ knock: 2 })
    expect(opts().params(1 / 60, 300, 475).angle).toBe(0)
  })

  it('l’inclinaison s’ajoute à l’angle (le pivot reste à `angle`) et demande une image', async () => {
    const w = mount(Door3D, { props: { variant: 'perron', angle: 30 } })
    await settle()
    opts().drawn()
    expect(opts().dirty()).toBe(false)
    await w.setProps({ lean: -5 })
    expect(opts().dirty()).toBe(true)
    expect(opts().params(1 / 60, 300, 475).angle).toBeCloseTo((25 * Math.PI) / 180)
  })

  it('les ombres suivent la prop `shadows` (gouverneur de qualité) et la demande d’une image', async () => {
    const w = mount(Door3D, { props: { variant: 'perron' } })
    await settle()
    expect(opts().params(1 / 60, 300, 475).shadows).toBe(1)
    opts().drawn()
    await w.setProps({ shadows: false })
    expect(opts().dirty()).toBe(true)
    expect(opts().params(1 / 60, 300, 475).shadows).toBe(0)
  })
})
