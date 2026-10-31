// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import BgPlace from '@/components/backgrounds/BgPlace.vue'
import CrtOverlay from '@/components/CrtOverlay.vue'
import { useProgressStore } from '@/stores/progress'
import { useSessionStore } from '@/stores/session'

// Cycle de vie GPU : remplacé par un espion qui garde la fonction de démarrage (appelée à la main) et les options.
type Demarrage = (canvas: HTMLCanvasElement, onLost: () => void) => Promise<unknown>
const gpu = vi.hoisted(() => ({
  start: null as null | Demarrage,
  options: null as null | Record<string, unknown>,
  lost: { value: false } as { value: boolean },
  status: { value: 'starting' } as { value: string },
}))
vi.mock('@/composables/useGpuEffect', async () => {
  const { ref: r } = await import('vue')
  return {
    useGpuEffect: (_canvas: unknown, start: Demarrage, options: Record<string, unknown>) => {
      gpu.start = start
      gpu.options = options
      gpu.lost = r(false)
      gpu.status = r('starting')
      return { lost: gpu.lost, status: gpu.status }
    },
  }
})
const audioLieu = vi.hoisted(() => vi.fn())
vi.mock('@/composables/usePlaceAudio', () => ({ usePlaceAudio: audioLieu }))
const createRaymarch = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ stop: () => {} })))
vi.mock('@/effects/raymarch', () => ({ createRaymarch }))
const startCrt = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ stop: () => {} })))
vi.mock('@/effects/crt', () => ({ startCrt }))
const config = vi.hoisted(() => ({ shader: 'wgsl-test', params: vi.fn((st: unknown) => ({ st })) }))
vi.mock('@/effects/places', () => ({ placeLoaders: { perron: async () => config } }))
vi.mock('@/effects/webgpu', () => ({ hasWebGpuAdapter: async () => true }))
const parallaxe = vi.hoisted(() => ({ tilt: { value: 0 }, roll: { value: 0 }, source: { value: 'mouse' } }))
vi.mock('@vueuse/core', async (orig) => {
  const { ref: r } = await import('vue')
  return {
    ...(await orig<typeof import('@vueuse/core')>()),
    useParallax: () => {
      parallaxe.tilt = r(0)
      parallaxe.roll = r(0)
      parallaxe.source = r('mouse')
      return parallaxe
    },
  }
})

let wrapper: VueWrapper | undefined
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const canvas = () => document.createElement('canvas')
type Opts = Record<string, (...a: never[]) => unknown> & { shader: string }
const demarrerLieu = async (props: Record<string, unknown> = {}) => {
  const pinia = createPinia()
  wrapper = mount(BgPlace, { props: { place: 'perron', ...props }, global: { plugins: [pinia] } })
  await gpu.start!(canvas(), () => {})
  return { opts: (createRaymarch.mock.calls[0] as unknown[])[1] as Opts, pinia }
}

describe('BgPlace', () => {
  it('démarre l’ambiance et la musique du lieu, avec le niveau de la progression', () => {
    const pinia = createPinia()
    wrapper = mount(BgPlace, { props: { place: 'perron' }, global: { plugins: [pinia] } })
    const [lieu, niveau] = audioLieu.mock.calls[0] as [() => string, () => number]
    expect(lieu()).toBe('perron')
    expect(niveau()).toBe(useProgressStore(pinia).level)
  })

  it('décor décoratif : masqué aux lecteurs d’écran, canevas visible tant que le GPU va bien', async () => {
    wrapper = mount(BgPlace, { props: { place: 'perron' }, global: { plugins: [createPinia()] } })
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('canvas').attributes('style') ?? '').not.toContain('display: none')
    gpu.lost.value = true
    await nextTick()
    expect(wrapper.get('canvas').attributes('style')).toContain('display: none')
  })

  it('crée le raymarch du lieu avec son shader et passe les variantes aux paramètres', async () => {
    const { opts } = await demarrerLieu({ variant: { a: 1 } })
    expect(opts.shader).toBe('wgsl-test')
    ;(opts.params as unknown as (s: object) => unknown)({ t: 2 })
    expect(config.params).toHaveBeenCalledWith({ t: 2, variant: { a: 1 } })
    expect(gpu.options).toMatchObject({ warning: 'Décor de lieu désactivé :' })
  })

  it('« sharp » et le mouvement réduit se reflètent dans les options', async () => {
    const { opts } = await demarrerLieu({ sharp: true })
    expect(opts.sharp()).toBe(true)
    expect(opts.motion()).toBe(true)
    wrapper!.unmount()
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }))
    createRaymarch.mockClear()
    const r = await demarrerLieu()
    expect(r.opts.sharp()).toBe(false)
    expect(r.opts.motion()).toBe(false)
  })

  it('la paranoïa vient de la progression', async () => {
    const { opts, pinia } = await demarrerLieu()
    expect(opts.paranoia()).toBe(useProgressStore(pinia).paranoia)
  })

  it('parallaxe souris : inclinaison doublée, bornée à [-1, 1], valeurs absurdes ramenées à 0', async () => {
    const { opts } = await demarrerLieu()
    const lire = () => opts.parallax() as { x: number; y: number }
    parallaxe.tilt.value = 0.25
    parallaxe.roll.value = -0.1
    expect(lire()).toEqual({ x: 0.5, y: -0.2 })
    parallaxe.tilt.value = 0.5
    parallaxe.roll.value = -2
    expect(lire()).toEqual({ x: 1, y: -1 })
    parallaxe.tilt.value = Number.NaN
    expect(lire().x).toBe(0)
  })

  it('parallaxe téléphone : seuls les gestes comptent, le repos se recentre', async () => {
    vi.useFakeTimers()
    const { opts } = await demarrerLieu()
    const lire = () => opts.parallax() as { x: number; y: number }
    parallaxe.source.value = 'deviceOrientation'
    parallaxe.tilt.value = 0.6 // un téléphone tenu en lecture est loin de 0
    parallaxe.roll.value = 0.1
    expect(lire()).toEqual({ x: 0, y: 0 }) // première lecture : pas de saut
    vi.advanceTimersByTime(100)
    parallaxe.tilt.value = 0.6 + 0.2 // grand geste : saturé
    const geste = lire()
    expect(geste.x).toBe(1)
    expect(Math.abs(geste.y)).toBeLessThan(0.05)
    vi.advanceTimersByTime(5000) // longue pause : reprise sans saut
    expect(lire()).toEqual({ x: 0, y: 0 })
  })
})

describe('CrtOverlay', () => {
  const monter = (props: { paranoia: number; off?: boolean }) => {
    const pinia = createPinia()
    wrapper = mount(CrtOverlay, { props, global: { plugins: [pinia] } })
    return { pinia }
  }
  const options = async () => {
    await gpu.start!(canvas(), () => {})
    return (startCrt.mock.calls[0] as unknown[])[1] as { motion: () => boolean; paranoia: () => number; paused: () => boolean; ripple: () => { age: number; amp: number }; onLost: unknown }
  }

  it('canevas décoratif, caché quand le GPU est perdu ou que la finale éteint l’écran', async () => {
    monter({ paranoia: 0.5 })
    const c = wrapper!.get('canvas')
    expect(c.attributes('aria-hidden')).toBe('true')
    expect(c.attributes('style') ?? '').not.toContain('display: none')
    gpu.lost.value = true
    await nextTick()
    expect(c.attributes('style')).toContain('display: none')
    gpu.lost.value = false
    await wrapper!.setProps({ off: true })
    expect(c.attributes('style')).toContain('display: none')
  })

  it('attend l’adaptateur WebGPU (porte) avec une borne de 5 s', async () => {
    monter({ paranoia: 0 })
    expect(gpu.options).toMatchObject({ timeout: 5000, warning: 'Surcouche CRT désactivée :' })
    await expect((gpu.options!.gate as () => Promise<boolean>)()).resolves.toBe(true)
  })

  it('démarre le CRT avec le mouvement, la paranoïa et la pause de la finale', async () => {
    monter({ paranoia: 0.4 })
    const o = await options()
    expect(o.motion()).toBe(true)
    expect(o.paranoia()).toBe(0.4)
    expect(o.paused()).toBe(false)
    await wrapper!.setProps({ paranoia: 0.9, off: true })
    expect(o.paranoia()).toBe(0.9)
    expect(o.paused()).toBe(true)
  })

  it('l’onde de coup : sans coup, âge plafonné ; après un coup, âge en secondes et amplitude modulée par la paranoïa', async () => {
    vi.useFakeTimers()
    const { pinia } = monter({ paranoia: 1 })
    const o = await options()
    expect(o.ripple()).toEqual({ age: 10, amp: 0 })
    useSessionStore(pinia).pulse(0.5)
    vi.advanceTimersByTime(500)
    const r = o.ripple()
    expect(r.age).toBeCloseTo(0.5, 1)
    expect(r.amp).toBeCloseTo(0.5)
    vi.advanceTimersByTime(60_000)
    expect(o.ripple().age).toBe(10)
    await wrapper!.setProps({ paranoia: 0 })
    expect(o.ripple().amp).toBeCloseTo(0.35)
  })

  it('l’objet d’onde est réutilisé à chaque image (aucune allocation par trame)', async () => {
    const { pinia } = monter({ paranoia: 0.5 })
    const o = await options()
    useSessionStore(pinia).pulse(1)
    expect(o.ripple()).toBe(o.ripple())
  })

  it('émet ready quand le GPU démarre et fail quand il est indisponible', async () => {
    monter({ paranoia: 0 })
    gpu.status.value = 'ready'
    await nextTick()
    expect(wrapper!.emitted('ready')).toHaveLength(1)
    expect(wrapper!.emitted('fail')).toBeUndefined()
    wrapper!.unmount()
    monter({ paranoia: 0 })
    gpu.status.value = 'unavailable'
    await nextTick()
    expect(wrapper!.emitted('fail')).toHaveLength(1)
    expect(wrapper!.emitted('ready')).toBeUndefined()
  })

  it('un échec d’init (failed) compte comme prêt : le CRT n’est que décoratif', async () => {
    monter({ paranoia: 0 })
    gpu.status.value = 'failed'
    await nextTick()
    expect(wrapper!.emitted('ready')).toHaveLength(1)
  })
})
