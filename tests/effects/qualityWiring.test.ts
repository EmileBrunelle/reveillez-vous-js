import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Même montage que gpuEffects.test.ts : boucle et vgpu simulés, le test pilote setup/render à la main.
const loop = vi.hoisted(() => ({ opts: null as null | Record<string, (...a: never[]) => unknown> }))
vi.mock('@/effects/gpuLoop', () => ({
  startGpuLoop: vi.fn(async (opts: Record<string, (...a: never[]) => unknown>) => {
    loop.opts = opts
    return { stop: vi.fn() }
  }),
}))
vi.mock('@vueuse/core', () => ({ useResizeObserver: () => undefined }))
// `timer` simulé : les résultats GPU sont poussés à la main par le test.
const timerMock = vi.hoisted(() => ({ cb: null as null | ((r: Record<string, number>) => void) }))
vi.mock('vgpu', () => ({
  surface: vi.fn((_gpu: unknown, _canvas: unknown, o: { dpr: number | number[] }) => ({ dpr: o.dpr, dispose: vi.fn(), o })),
  effect: vi.fn(() => ({ set: vi.fn(), dispose: vi.fn() })),
  timer: vi.fn(() => ({
    span: () => ({}),
    onResults: (cb: (r: Record<string, number>) => void) => {
      timerMock.cb = cb
      return () => undefined
    },
    dispose: vi.fn(),
  })),
}))

import { surface } from 'vgpu'
import { crtDprRange, LITE_BY_LEVEL, startCrt } from '@/effects/crt'
import { crtStaticKey } from '@/effects/frameSkip'
import { createRaymarch, DETAIL_BY_LEVEL } from '@/effects/raymarch'
import { placeDpr, RES_BY_LEVEL } from '@/effects/resolution'
import { cutShadowsForSession, resetShadowVerdict, shadowsCutForSession } from '@/effects/shadowQuality'
import type { QualityLevel } from '@/stores/quality'
import { rue } from '@/effects/places/rue'
import { foret } from '@/effects/places/foret'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- état interne non exporté des effets
type Any = any
const canvas = () => ({ width: 300, height: 200, clientWidth: 1000, clientHeight: 600 }) as unknown as HTMLCanvasElement
const frame = () => ({ pass: vi.fn() })
const clk = (time: number, deltaTime = 1 / 30) => ({ time, deltaTime })
const run = <T>(fn: unknown, ...args: unknown[]) => (fn as (...a: unknown[]) => T)(...args)

beforeEach(() => {
  loop.opts = null
  timerMock.cb = null
  resetShadowVerdict()
  vi.mocked(surface).mockClear()
  vi.stubGlobal('window', { devicePixelRatio: 2 })
})
afterEach(() => vi.unstubAllGlobals())

describe('résolution selon le niveau', () => {
  it('high : inchangé ; low réduit l’échelle sous CRT et le plafond de pixels sans CRT', () => {
    expect(placeDpr(1000, 600, false, 2)).toBe(placeDpr(1000, 600, false, 2, 'high'))
    expect(placeDpr(1000, 600, false, 2, 'low')).toBeCloseTo(0.5 * RES_BY_LEVEL.low.scale)
    expect(placeDpr(1000, 600, false, 2, 'medium')).toBe(0.5)
    const px = (l: QualityLevel) => 1000 * 600 * placeDpr(1000, 600, true, 3, l) ** 2
    expect(px('high')).toBeGreaterThan(px('medium'))
    expect(px('medium')).toBeGreaterThan(px('low'))
    expect(placeDpr(1000, 600, true, 3, 'low')).toBeGreaterThanOrEqual(placeDpr(1000, 600, false, 3, 'low')) // jamais sous le facteur CRT
  })
})

describe('fonds raymarchés : DPR, densité, ombres', () => {
  const make = (level: { v: QualityLevel }, over: Record<string, unknown> = {}) => {
    const params = vi.fn((s: { t: number; detail?: number }) => ({ time: s.t, density: s.detail ?? 1 }))
    const p = createRaymarch(canvas(), { shader: 's' as never, params, motion: () => true, paranoia: () => 0, parallax: () => ({ x: 0, y: 0 }), quality: () => level.v, shadows: () => true, ...over })
    return { params, p }
  }

  it('le DPR de la surface suit le niveau, y compris un changement en cours de route', async () => {
    const level = { v: 'high' as QualityLevel }
    await make(level).p
    const s = run<Any>(loop.opts!.setup, {})
    expect(s.surf.dpr).toBe(0.5)
    level.v = 'low'
    run(loop.opts!.render, frame(), s, clk(1))
    expect(s.surf.dpr).toBeCloseTo(0.375)
  })

  it('le DPR lit le niveau posé (`settledQuality`) : une descente en cours ne recrée pas la surface avant la transition', async () => {
    const level = { v: 'high' as QualityLevel }
    const settled = { v: 'high' as QualityLevel }
    await make(level, { settledQuality: () => settled.v }).p
    const s = run<Any>(loop.opts!.setup, {})
    const surf = s.surf
    level.v = 'low' // descente décidée, pas encore posée
    run(loop.opts!.render, frame(), s, clk(1))
    expect(s.surf).toBe(surf)
    expect(s.surf.dpr).toBe(0.5)
    settled.v = 'low'
    run(loop.opts!.render, frame(), s, clk(2))
    expect(s.surf.dpr).toBeCloseTo(0.375)
  })

  it('la densité (uniform) glisse vers la cible du niveau sans sauter, et reste à 1 en high', async () => {
    const level = { v: 'high' as QualityLevel }
    await make(level).p
    const s = run<Any>(loop.opts!.setup, {})
    expect(s.anim.detail).toBe(1)
    level.v = 'low'
    run(loop.opts!.render, frame(), s, clk(1, 1 / 30))
    expect(s.anim.detail).toBeLessThan(1)
    expect(s.anim.detail).toBeGreaterThan(DETAIL_BY_LEVEL.low + 0.5) // un pas ne fait pas le chemin
    for (let i = 0; i < 400; i++) run(loop.opts!.render, frame(), s, clk(2 + i / 30, 1 / 30))
    expect(s.anim.detail).toBeCloseTo(DETAIL_BY_LEVEL.low, 2)
  })

  it('les places transmettent `detail` à l’uniform `density` (1 par défaut)', () => {
    const s = { t: 0, width: 1, height: 1, paranoia: 0, motion: true, drift: 0, px: 0, py: 0 }
    expect(rue.params(s).density).toBe(1)
    expect(rue.params({ ...s, detail: 0.4 }).density).toBe(0.4)
    expect(foret.params(s).density).toBe(1)
    expect(foret.params({ ...s, detail: 0.4 }).density).toBe(0.4)
  })

  it('le temps GPU du passage est rapporté au gouverneur (onGpuSample), ombres allumées ou non', async () => {
    const onGpuSample = vi.fn()
    const level = { v: 'medium' as QualityLevel }
    await make(level, { onGpuSample, shadows: () => false }).p
    run(loop.opts!.setup, {})
    timerMock.cb!({ fond: 7.5 })
    expect(onGpuSample).toHaveBeenCalledWith(7.5)
  })

  it('budget des ombres dépassé : onShadowsOver une seule fois, ombres coupées ; remise à zéro du verdict : nouvelle mesure, ombres de retour', async () => {
    const onShadowsOver = vi.fn()
    const level = { v: 'high' as QualityLevel }
    await make(level, { onShadowsOver }).p
    const s = run<Any>(loop.opts!.setup, {})
    const f = frame()
    for (let i = 0; i < 40; i++) timerMock.cb!({ fond: 20 })
    run(loop.opts!.render, f, s, clk(1))
    run(loop.opts!.render, f, s, clk(2))
    expect(onShadowsOver).toHaveBeenCalledOnce()
    expect(shadowsCutForSession()).toBe(true)
    expect(s.fx.set).toHaveBeenLastCalledWith({ params: expect.objectContaining({ shadows: 0 }) })
    resetShadowVerdict() // le gouverneur remonte à high
    run(loop.opts!.render, f, s, clk(3))
    expect(s.fx.set).toHaveBeenLastCalledWith({ params: expect.objectContaining({ shadows: 1 }) })
    for (let i = 0; i < 40; i++) timerMock.cb!({ fond: 3 }) // le fond tient dans le budget : les ombres restent
    run(loop.opts!.render, f, s, clk(4))
    expect(s.fx.set).toHaveBeenLastCalledWith({ params: expect.objectContaining({ shadows: 1 }) })
    expect(onShadowsOver).toHaveBeenCalledOnce()
    cutShadowsForSession()
    resetShadowVerdict()
  })
})

describe('CRT : allègement et résolution selon le niveau', () => {
  const make = (level: { v: QualityLevel }, settled: { v: QualityLevel }) =>
    startCrt(canvas(), { motion: () => true, paranoia: () => 0, ripple: () => ({ age: 10, amp: 0 }), quality: () => level.v, settledQuality: () => settled.v })

  it('high : comme avant (DPR [1, 1,5], lite 0) ; low : lite visé à 1, DPR plafonné à 1', () => {
    expect(crtDprRange('high')).toEqual([1, 1.5])
    expect(crtDprRange('medium')).toEqual([1, 1.5])
    expect(crtDprRange('low')).toEqual([1, 1])
    expect(LITE_BY_LEVEL).toEqual({ high: 0, medium: 0, low: 1 })
  })

  it('`lite` glisse sans saut et la surface ne change qu’au niveau posé', async () => {
    const level = { v: 'high' as QualityLevel }
    const settled = { v: 'high' as QualityLevel }
    await make(level, settled)
    const s = run<Any>(loop.opts!.setup, {})
    expect(s.params.lite).toBe(0)
    expect(vi.mocked(surface)).toHaveBeenLastCalledWith({}, expect.anything(), expect.objectContaining({ dpr: [1, 1.5] }))
    level.v = 'low' // descente décidée : le grain s’éteint en douceur, la surface attend
    const f = frame()
    run(loop.opts!.render, f, s, clk(1, 1 / 30))
    expect(s.params.lite).toBeGreaterThan(0)
    expect(s.params.lite).toBeLessThan(0.1) // un pas = une petite fraction
    expect(vi.mocked(surface)).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 300; i++) run(loop.opts!.render, f, s, clk(2 + i / 30, 1 / 30))
    expect(s.params.lite).toBeCloseTo(1, 2)
    expect(vi.mocked(surface)).toHaveBeenCalledTimes(1)
    settled.v = 'low' // transition de scène ou de phase
    run(loop.opts!.render, f, s, clk(20, 1 / 30))
    expect(vi.mocked(surface)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(surface)).toHaveBeenLastCalledWith({}, expect.anything(), expect.objectContaining({ dpr: [1, 1] }))
  })

  it('la clé de l’image statique ne change que si `lite` est non nul (format inchangé en high)', () => {
    expect(crtStaticKey(10, 10, 0.5)).toBe('10x10|0.500')
    expect(crtStaticKey(10, 10, 0.5, 0)).toBe('10x10|0.500')
    expect(crtStaticKey(10, 10, 0.5, 1)).not.toBe(crtStaticKey(10, 10, 0.5, 0))
  })
})
