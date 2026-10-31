// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'

// Observateur de taille piloté à la main : happy-dom n’en déclenche jamais.
const ro = vi.hoisted(() => ({ cb: null as null | (() => void) }))
vi.mock('@vueuse/core', async (orig) => ({
  ...(await orig<typeof import('@vueuse/core')>()),
  useResizeObserver: (_t: unknown, cb: () => void) => {
    ro.cb = cb
  },
}))
import { useFitBody } from '@/composables/useFitBody'

const define = (el: HTMLElement, props: Record<string, unknown>) =>
  Object.entries(props).forEach(([k, v]) => Object.defineProperty(el, k, typeof v === 'function' ? { get: v as () => unknown, configurable: true } : { value: v, configurable: true, writable: true }))

// Un « texte » fictif : sa hauteur vaut taille de police × nombre de lignes, qui dépend de l’emblème (plus il est grand, moins le panneau a de place).
const setup = ({ lines = { '': 40, small: 20, none: 10 } as Record<string, number>, w = 400, height = 600, room = 300 } = {}) => {
  const root = document.createElement('div')
  const panel = document.createElement('div')
  const body = document.createElement('p')
  const reads = { body: 0 }
  define(root, { offsetWidth: () => w, offsetHeight: () => height })
  define(panel, { clientHeight: room + 20, scrollHeight: () => body.offsetHeight + 20 })
  define(body, {
    offsetHeight: () => {
      reads.body++
      return parseFloat(body.style.fontSize) * (lines[root.dataset.emblem ?? ''] ?? 0)
    },
  })
  const source = ref('a')
  let api!: ReturnType<typeof useFitBody>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useFitBody({ root: shallowRef(root), panel: shallowRef(panel), body: shallowRef(body), sources: [source] })
        return () => h('div')
      },
    }),
  )
  return { root, panel, body, source, reads, api, wrapper }
}
const frame = async () => {
  vi.advanceTimersByTime(20)
  await nextTick()
}

describe('useFitBody', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('getComputedStyle', () => ({ paddingTop: '10px', paddingBottom: '10px' }))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('texte court : la police monte au plafond (34 px sur 400 px de large), emblème entier', async () => {
    const { api, body, root, wrapper } = setup({ lines: { '': 1, small: 1, none: 1 } })
    await frame()
    expect(api.bodyPx.value).toBe(34)
    expect(api.emblem.value).toBe('')
    expect(body.style.fontSize).toBe('34px')
    expect(root.dataset.emblem).toBeUndefined()
    wrapper.unmount()
  })

  it('le plafond suit la largeur : 9 % de la carte, mais 7,5 % si la carte est très large', async () => {
    const narrow = setup({ w: 300, lines: { '': 1, small: 1, none: 1 } })
    await frame()
    expect(narrow.api.bodyPx.value).toBe(27) // 9 % de 300 < 34
    narrow.wrapper.unmount()
    const wide = setup({ w: 1152, lines: { '': 1, small: 1, none: 1 } })
    await frame()
    expect(wide.api.bodyPx.value).toBeCloseTo(86.4, 5) // 7,5 % de 1152 l’emporte sur 34 × 2 et reste sous 9 %
    wide.wrapper.unmount()
  })

  it('texte long : recherche la plus grande police qui tient dans le panneau', async () => {
    const { api, body, wrapper } = setup({ lines: { '': 10, small: 10, none: 10 }, room: 300 })
    await frame()
    expect(api.emblem.value).toBe('')
    expect(api.bodyPx.value).toBeGreaterThan(29.5)
    expect(api.bodyPx.value).toBeLessThanOrEqual(30.5) // tolérance de 0,5 px de la mesure
    expect(body.offsetHeight).toBeLessThanOrEqual(300.5)
    wrapper.unmount()
  })

  it('l’emblème rétrécit (small) quand l’emblème entier ne laisse pas assez de place, même à 11 px', async () => {
    const { api, root, wrapper } = setup({ lines: { '': 40, small: 20, none: 10 }, room: 300 })
    await frame()
    expect(api.emblem.value).toBe('small')
    expect(root.dataset.emblem).toBe('small')
    expect(api.bodyPx.value).toBeGreaterThanOrEqual(11)
    expect(api.bodyPx.value).toBeLessThanOrEqual(15.5)
    wrapper.unmount()
  })

  it('puis disparaît (none) en dernier recours', async () => {
    const { api, root, wrapper } = setup({ lines: { '': 40, small: 30, none: 10 }, room: 300 })
    await frame()
    expect(api.emblem.value).toBe('none')
    expect(root.dataset.emblem).toBe('none')
    expect(api.bodyPx.value).toBeGreaterThan(29)
    wrapper.unmount()
  })

  it('texte impossible à faire tenir : plancher à 11 px sans emblème', async () => {
    const { api, wrapper } = setup({ lines: { '': 100, small: 100, none: 100 }, room: 300 })
    await frame()
    expect(api.emblem.value).toBe('none')
    expect(api.bodyPx.value).toBe(11)
    wrapper.unmount()
  })

  it('ne mesure rien tant que la carte n’a pas de taille (largeur nulle)', async () => {
    const { api, reads, wrapper } = setup({ w: 0 })
    await frame()
    expect(api.bodyPx.value).toBe(0)
    expect(reads.body).toBe(0)
    wrapper.unmount()
  })

  it('redimensionnement sans changement de taille : pas de nouvelle mesure ; changement de contenu : nouvelle mesure forcée', async () => {
    const { reads, source, wrapper } = setup()
    await frame()
    const first = reads.body
    expect(first).toBeGreaterThan(0)
    ro.cb!()
    await frame()
    expect(reads.body).toBe(first)
    source.value = 'b'
    await nextTick() // le watcher planifie l’ajustement
    await frame()
    expect(reads.body).toBeGreaterThan(first)
    wrapper.unmount()
  })

  it('une nouvelle taille de carte relance l’ajustement', async () => {
    const { reads, root, api, wrapper } = setup({ lines: { '': 1, small: 1, none: 1 } })
    await frame()
    const before = reads.body
    define(root, { offsetWidth: 200 })
    ro.cb!()
    await frame()
    expect(reads.body).toBeGreaterThan(before)
    expect(api.bodyPx.value).toBe(18) // 9 % de 200
    wrapper.unmount()
  })

  it('le chargement des polices relance l’ajustement', async () => {
    let ready!: () => void
    vi.stubGlobal('document', Object.assign(Object.create(document), { fonts: { ready: new Promise<void>((r) => (ready = r)) } }))
    const { reads, wrapper } = setup()
    await frame()
    const before = reads.body
    ready()
    await Promise.resolve()
    await Promise.resolve()
    await frame()
    expect(reads.body).toBeGreaterThan(before)
    wrapper.unmount()
  })
})
