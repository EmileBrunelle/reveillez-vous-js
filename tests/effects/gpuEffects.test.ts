import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// startGpuLoop est simulé : le test récupère les options (setup/render/teardown) et les pilote à la main, sans GPU.
const loop = vi.hoisted(() => ({ opts: null as null | Record<string, (...a: never[]) => unknown>, stop: undefined as undefined | (() => void) }))
vi.mock('@/effects/gpuLoop', () => ({
  startGpuLoop: vi.fn(async (opts: Record<string, (...a: never[]) => unknown>) => {
    loop.opts = opts
    loop.stop = vi.fn()
    return { stop: loop.stop }
  }),
}))

const resize = vi.hoisted(() => ({ cb: null as null | ((e: unknown[]) => void) }))
vi.mock('@vueuse/core', () => ({
  useResizeObserver: (_el: unknown, cb: (e: unknown[]) => void) => {
    resize.cb = cb
  },
}))

// vgpu simulé : surface et effet enregistrent leurs appels.
vi.mock('vgpu', () => ({
  surface: vi.fn((_gpu: unknown, _canvas: unknown, o: { dpr: number | number[] }) => ({ dpr: o.dpr, dispose: vi.fn(), o })),
  effect: vi.fn((_gpu: unknown, _shader: unknown, o: { set: { params: unknown } }) => ({ set: vi.fn(), dispose: vi.fn(), initial: o.set.params })),
}))

import { effect, surface } from 'vgpu'
import { startCrt } from '@/effects/crt'
import { createCrystal } from '@/effects/crystal'
import { createRaymarch } from '@/effects/raymarch'
import { RING_SIZE } from '@/effects/crystalMath'

// Les rappels setup/render/teardown reçoivent un état interne propre à chaque effet (surface, effet, paramètres) : seul le test le consulte.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- état interne non exporté des effets, différent pour chacun
type Any = any
const canvas = (over: Partial<{ width: number; height: number; clientWidth: number; clientHeight: number }> = {}) =>
  ({ width: 300, height: 200, clientWidth: 600, clientHeight: 400, ...over }) as unknown as HTMLCanvasElement
const frame = () => ({ pass: vi.fn() })
const clk = (time: number, deltaTime = 1 / 30) => ({ time, deltaTime })
const run = <T>(fn: unknown, ...args: unknown[]) => (fn as (...a: unknown[]) => T)(...args)

beforeEach(() => {
  vi.mocked(surface).mockClear()
  vi.mocked(effect).mockClear()
  loop.opts = null
})

describe('startCrt', () => {
  const make = (over: Partial<Parameters<typeof startCrt>[1]> = {}) => {
    const c = canvas()
    const state = { motion: true, paranoia: 0.5, ripple: { age: 2, amp: 0.4 } }
    const onLost = vi.fn()
    const opts = { motion: () => state.motion, paranoia: () => state.paranoia, ripple: () => state.ripple, onLost, ...over }
    return { c, state, onLost, p: startCrt(c, opts) }
  }

  it('la boucle suit la pause demandée en direct, prévient de la perte du périphérique et s’arrête avec stop()', async () => {
    const pause = { v: false }
    const { p, onLost } = make({ paused: () => pause.v })
    const handle = await p
    expect(run(loop.opts!.paused)).toBe(false)
    pause.v = true // la pause décidée par l’appelant est relue à chaque vérification de la boucle
    expect(run(loop.opts!.paused)).toBe(true)
    run(loop.opts!.onLost)
    expect(onLost).toHaveBeenCalledOnce()
    expect(loop.stop).not.toHaveBeenCalled()
    handle.stop()
    expect(loop.stop).toHaveBeenCalledOnce()
  })

  it('setup : surface à DPR plafonné à 1,5 et fond transparent, effet CRT, paranoïa initiale lue', async () => {
    const { p, c } = make()
    await p
    const s = run<Any>(loop.opts!.setup, {})
    expect(surface).toHaveBeenCalledWith({}, c, { dpr: [1, 1.5], clearColor: [0, 0, 0, 0] })
    expect(effect).toHaveBeenCalledOnce()
    expect(s.params.paranoia).toBe(0.5)
    expect(s.lastKey).toBe('')
    run(loop.opts!.teardown, s)
    expect(s.fx.dispose).toHaveBeenCalledOnce()
  })

  it('render animé : écrit tous les paramètres et passe la trame, temps replié sur la période de 100 s', async () => {
    const { p, c } = make()
    await p
    const s = run<Any>(loop.opts!.setup, {})
    const f = frame()
    run(loop.opts!.render, f, s, clk(250))
    expect(s.params).toMatchObject({ time: 50, height: c.height, width: c.width, motion: 1, rippleAge: 2, rippleAmp: 0.4 })
    expect(s.fx.set).toHaveBeenCalledWith({ params: s.params })
    expect(f.pass).toHaveBeenCalledWith(s.surf, s.fx)
  })

  it('render : la paranoïa converge vers la cible sans la dépasser, et le pas est borné à 0,1 s', async () => {
    const { p, state } = make()
    await p
    const s = run<Any>(loop.opts!.setup, {})
    state.paranoia = 1
    run(loop.opts!.render, frame(), s, clk(0, 0.016))
    const small = s.params.paranoia
    expect(small).toBeGreaterThan(0.5)
    expect(small).toBeLessThan(1)
    state.paranoia = 0.5
    const s2 = run<Any>(loop.opts!.setup, {})
    const s3 = run<Any>(loop.opts!.setup, {})
    state.paranoia = 1
    run(loop.opts!.render, frame(), s2, clk(0, 50))
    run(loop.opts!.render, frame(), s3, clk(0, 0.1))
    expect(s2.params.paranoia).toBeCloseTo(s3.params.paranoia, 10)
    expect(s2.params.paranoia).toBeLessThan(1)
  })

  it('mouvement réduit : une seule image statique tant que taille et paranoïa ne changent pas', async () => {
    const { p, c, state } = make()
    state.motion = false
    await p
    const s = run<Any>(loop.opts!.setup, {})
    const f = frame()
    run(loop.opts!.render, f, s, clk(1))
    expect(s.params.motion).toBe(0)
    expect(f.pass).toHaveBeenCalledTimes(1)
    run(loop.opts!.render, f, s, clk(2))
    expect(f.pass).toHaveBeenCalledTimes(1)
    ;(c as Any).width = 640 // redimensionnement : la clé change, on redessine
    run(loop.opts!.render, f, s, clk(3))
    expect(f.pass).toHaveBeenCalledTimes(2)
  })
})

describe('createCrystal', () => {
  const make = (over: Partial<Parameters<typeof createCrystal>[1]> = {}) => {
    const c = canvas()
    const state = { motion: true, points: [] as number[], grid: [] as number[], done: 0 }
    const p = createCrystal(c, { motion: () => state.motion, points: () => state.points, grid: () => state.grid, done: () => state.done, seed: 7, ...over })
    return { c, state, p }
  }

  it('pause lue en direct et perte signalée ; setup crée des tampons vec4 à zéro avec la graine', async () => {
    const pause = { v: false }
    const onLost = vi.fn()
    const { p, c } = make({ paused: () => pause.v, onLost })
    await p
    expect(run(loop.opts!.paused)).toBe(false)
    pause.v = true
    expect(run(loop.opts!.paused)).toBe(true)
    run(loop.opts!.onLost)
    expect(onLost).toHaveBeenCalledOnce()
    const s = run<Any>(loop.opts!.setup, {})
    expect(surface).toHaveBeenCalledWith({}, c, { dpr: [1, 1.5], clearColor: [0, 0, 0, 0] })
    expect(s.params.seed).toBe(7)
    expect(s.params[`p${RING_SIZE - 1}`]).toEqual([0, 0, 0, 0])
    expect(s.params.g3).toEqual([0, 0, 0, 0])
    expect(s.drawn).toBe(false)
    run(loop.opts!.teardown, s)
    expect(s.fx.dispose).toHaveBeenCalledOnce()
  })

  it('animé : redessine à chaque image, temps replié sur 600 s, coups et grille copiés dans les vec4', async () => {
    const { p, state } = make()
    await p
    const s = run<Any>(loop.opts!.setup, {})
    state.points = [0.1, 0.2, 3, 1]
    state.grid = [0, 0, 0, 0, 5, 6, 7, 8]
    const f = frame()
    run(loop.opts!.render, f, s, clk(650))
    run(loop.opts!.render, f, s, clk(651))
    expect(f.pass).toHaveBeenCalledTimes(2)
    expect(s.params.time).toBe(51)
    expect(s.params.motion).toBe(1)
    expect(s.params.p0).toEqual([0.1, 0.2, 3, 1])
    expect(s.params.g1).toEqual([5, 6, 7, 8])
  })

  it('mouvement réduit : dessine une fois, puis seulement si coups, grille ou dissipation changent', async () => {
    const { p, state } = make()
    state.motion = false
    await p
    const s = run<Any>(loop.opts!.setup, {})
    const f = frame()
    run(loop.opts!.render, f, s, clk(5))
    expect(f.pass).toHaveBeenCalledTimes(1)
    expect(s.params.time).toBe(0)
    expect(s.params.motion).toBe(0)
    run(loop.opts!.render, f, s, clk(6))
    expect(f.pass).toHaveBeenCalledTimes(1) // rien n’a bougé : image sautée
    state.points = [1, 1, 1, 1]
    run(loop.opts!.render, f, s, clk(7))
    expect(f.pass).toHaveBeenCalledTimes(2)
    state.grid = [9]
    run(loop.opts!.render, f, s, clk(8))
    expect(f.pass).toHaveBeenCalledTimes(3)
    state.done = 0.5
    run(loop.opts!.render, f, s, clk(9))
    expect(f.pass).toHaveBeenCalledTimes(4)
    expect(s.params.done).toBe(0.5)
    run(loop.opts!.render, f, s, clk(10))
    expect(f.pass).toHaveBeenCalledTimes(4)
  })
})

describe('createRaymarch', () => {
  const shader = 'shader' as never
  const make = (over: Partial<Parameters<typeof createRaymarch>[1]> = {}) => {
    const c = canvas()
    const state = { motion: true, paranoia: 0.2, parallax: { x: 1, y: -1 } }
    const params = vi.fn((s: { t: number; paranoia: number; drift: number; px: number; py: number; motion: boolean }) => ({ time: s.t, p: s.paranoia, drift: s.drift, px: s.px, py: s.py }))
    const p = createRaymarch(c, { shader, params, motion: () => state.motion, paranoia: () => state.paranoia, parallax: () => state.parallax, ...over })
    return { c, state, params, p }
  }
  const dt = clk(10, 0.05)
  beforeEach(() => vi.stubGlobal('window', { devicePixelRatio: 1 }))
  afterEach(() => vi.unstubAllGlobals())

  it('cadence : 30 i/s animé, 4 i/s en mouvement réduit', async () => {
    const { p, state } = make()
    await p
    const fps = loop.opts!.fps as () => number
    expect(fps()).toBe(30)
    state.motion = false
    expect(fps()).toBe(4)
  })

  it('setup : surface au DPR du lieu (CRT : 0,5), paramètres initiaux à t = 0', async () => {
    const { p, params } = make()
    await p
    const s = run<Any>(loop.opts!.setup, {})
    expect(s.surf.dpr).toBe(0.5)
    expect(params).toHaveBeenCalledWith(expect.objectContaining({ t: 0, width: 300, height: 200, paranoia: 0.2, motion: true }))
    expect(s.anim.p).toBe(0.2)
    run(loop.opts!.teardown, s)
    expect(s.fx.dispose).toHaveBeenCalledOnce()
  })

  it('animé : la parallaxe et la dérive avancent, la paranoïa converge, la trame est passée', async () => {
    const { p, params, state } = make()
    await p
    const s = run<Any>(loop.opts!.setup, {})
    state.paranoia = 1
    const f = frame()
    run(loop.opts!.render, f, s, dt)
    expect(s.anim.px).toBeGreaterThan(0)
    expect(s.anim.px).toBeLessThan(1)
    expect(s.anim.py).toBeLessThan(0)
    expect(s.anim.drift).toBeCloseTo(0.05)
    expect(s.anim.p).toBeGreaterThan(0.2)
    expect(f.pass).toHaveBeenCalledWith(s.surf, s.fx)
    expect(s.fx.set).toHaveBeenCalledWith({ params: expect.objectContaining({ time: 10 }) })
    expect(params).toHaveBeenLastCalledWith(expect.objectContaining({ drift: s.anim.drift, px: s.anim.px }))
  })

  it('mouvement réduit : dérive et parallaxe valent 0 ; une image statique par clé, redessinée si la taille change', async () => {
    const { p, c, state, params } = make()
    state.motion = false
    await p
    const s = run<Any>(loop.opts!.setup, {})
    const f = frame()
    run(loop.opts!.render, f, s, dt)
    run(loop.opts!.render, f, s, dt)
    expect(f.pass).toHaveBeenCalledTimes(1)
    expect(s.anim.px).toBe(0)
    expect(s.anim.drift).toBe(0)
    expect(params).toHaveBeenLastCalledWith(expect.objectContaining({ motion: false, drift: 0, px: 0, py: 0 }))
    ;(c as Any).height = 999
    run(loop.opts!.render, f, s, dt)
    expect(f.pass).toHaveBeenCalledTimes(2)
  })

  it('ombres : l’uniforme `shadows` suit la règle fournie ; sans règle, aucun champ ajouté et pas de mesure GPU', async () => {
    const rule = { v: true }
    const { p, params } = make({ shadows: () => rule.v })
    await p
    expect(loop.opts!.timing).toBe(true)
    const s = run<Any>(loop.opts!.setup, {}) // `timer` absent du vgpu simulé : repli sur l’intervalle entre images
    expect(s.cost.span).toBeNull()
    const f = frame()
    run(loop.opts!.render, f, s, dt)
    expect(s.fx.set).toHaveBeenLastCalledWith({ params: expect.objectContaining({ shadows: 1 }) })
    expect(f.pass).toHaveBeenCalledWith(s.surf, s.fx)
    rule.v = false // tactile ou écran étroit
    run(loop.opts!.render, f, s, dt)
    expect(s.fx.set).toHaveBeenLastCalledWith({ params: expect.objectContaining({ shadows: 0 }) })
    expect(params).toHaveBeenCalled()
    run(loop.opts!.teardown, s)
    const plain = make()
    await plain.p
    expect(loop.opts!.timing).toBe(false)
    const s2 = run<Any>(loop.opts!.setup, {})
    expect(s2.cost).toBeNull()
    expect((vi.mocked(effect).mock.calls.at(-1) as Any)[2].set.params).not.toHaveProperty('shadows')
  })

  it('ombres : le repli coupe pour de bon quand les images dépassent l’intervalle toléré', async () => {
    const { p } = make({ shadows: () => true })
    await p
    const s = run<Any>(loop.opts!.setup, {})
    const f = frame()
    for (let i = 0; i < 40; i++) run(loop.opts!.render, f, s, clk(i, 0.09)) // 90 ms par image : très en deçà de 30 i/s
    run(loop.opts!.render, f, s, clk(41, 1 / 30))
    expect(s.fx.set).toHaveBeenLastCalledWith({ params: expect.objectContaining({ shadows: 0 }) })
  })

  it('CRT éteint (sharp) : la surface est recréée à la résolution nette, l’ancienne est libérée', async () => {
    const sharp = { v: false }
    vi.stubGlobal('window', { devicePixelRatio: 2 })
    const { p } = make({ sharp: () => sharp.v })
    await p
    const s = run<Any>(loop.opts!.setup, {})
    const old = s.surf
    sharp.v = true
    run(loop.opts!.render, frame(), s, dt)
    expect(old.dispose).toHaveBeenCalledOnce()
    expect(s.surf).not.toBe(old)
    expect(s.surf.dpr).toBeGreaterThan(0.5)
    expect(vi.mocked(surface)).toHaveBeenCalledTimes(2)
  })

  it('l’observateur de taille met à jour la taille CSS qui sert au DPR', async () => {
    const sharp = { v: true }
    const { p } = make({ sharp: () => sharp.v })
    await p
    const s = run<Any>(loop.opts!.setup, {})
    const first = s.dprFor()
    resize.cb!([{ contentRect: { width: 3000, height: 2000 } }])
    expect(s.dprFor()).toBeLessThanOrEqual(first)
  })

  it('pause lue en direct ; la perte du périphérique est signalée à l’appelant', async () => {
    const pause = { v: true }
    const onLost = vi.fn()
    const { p } = make({ paused: () => pause.v, onLost })
    await p
    expect(run(loop.opts!.paused)).toBe(true)
    pause.v = false
    expect(run(loop.opts!.paused)).toBe(false)
    run(loop.opts!.onLost)
    expect(onLost).toHaveBeenCalledOnce()
  })
})
