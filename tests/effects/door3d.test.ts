import { beforeEach, describe, expect, it, vi } from 'vitest'

// startGpuLoop est simulé : le test pilote setup/render à la main et lit la pause, sans GPU.
const loop = vi.hoisted(() => ({ opts: null as null | Record<string, unknown> }))
vi.mock('@/effects/gpuLoop', () => ({
  startGpuLoop: vi.fn(async (opts: Record<string, unknown>) => {
    loop.opts = opts
    return { stop: vi.fn() }
  }),
}))
vi.mock('vgpu', () => ({
  surface: vi.fn(() => ({ dispose: vi.fn(), onResize: vi.fn(() => () => {}) })),
  effect: vi.fn(() => ({ set: vi.fn(), dispose: vi.fn() })),
  timer: vi.fn(),
}))

import { createDoor3d, door3dDpr } from '@/effects/door3d'
import { createKnockSpring, door3dOpening, door3dParams, door3dSilhouette, DOOR3D_PRESETS, KNOCK_DAMPING, KNOCK_STIFFNESS, MAX_ANGLE_DEG, hexLinear } from '@/effects/door3dMath'

const base = () => ({ angleDeg: 0, knockDeg: 0, width: 300, height: 475, shadows: true, ...DOOR3D_PRESETS.perron, interior: 1, mist: 1 })

describe('door3dParams', () => {
  it('convertit l’angle (ouverture + ressort) en radians et le borne', () => {
    expect(door3dParams({ ...base(), angleDeg: 40, knockDeg: -2 }).angle).toBeCloseTo((38 * Math.PI) / 180)
    expect(door3dParams({ ...base(), angleDeg: 200 }).angle).toBeCloseTo((MAX_ANGLE_DEG * Math.PI) / 180)
    expect(door3dParams({ ...base(), angleDeg: 0, knockDeg: -50 }).angle).toBeCloseTo((-6 * Math.PI) / 180)
  })

  it('écrit la lumière, le matériau et les réglages du lieu dans les champs de l’uniforme', () => {
    const { look, light } = DOOR3D_PRESETS.rue
    const p = door3dParams({ ...base(), look, light, shadows: false, interior: 2, mist: -1 })
    expect([p.lx, p.ly, p.lz]).toEqual([...light.dir])
    expect([p.lr, p.lg, p.lb]).toEqual([...light.color])
    expect([p.wr, p.wg, p.wb]).toEqual([...look.wood])
    expect([p.style, p.cols, p.rows, p.shadows, p.interior, p.mist]).toEqual([look.style, look.cols, look.rows, 0, 1, 0])
    expect(Object.values(p).every(Number.isFinite)).toBe(true)
  })

  it('chaque lieu a une lumière normalisée, venue de devant (face de la porte éclairée)', () => {
    for (const { light } of Object.values(DOOR3D_PRESETS)) {
      expect(Math.hypot(...light.dir)).toBeCloseTo(1)
      expect(light.dir[2]).toBeLessThan(0)
    }
    expect(hexLinear('#ffffff')).toEqual([1, 1, 1])
  })

  it('chaque lieu garde l’encadrement de son SVG, dans la boîte du shader', () => {
    const trims = Object.fromEntries(Object.entries(DOOR3D_PRESETS).map(([k, { look }]) => [k, look.trim]))
    expect(trims).toEqual({ perron: 3, foret: 0, cimetiere: 2, rue: 1, nuages: 4 })
    for (const { look } of Object.values(DOOR3D_PRESETS)) {
      // Le linteau (ou l’imposte) est posé à 1,70 m : l’ouverture ne le dépasse jamais.
      expect(look.opening).toBeGreaterThan(1)
      expect(look.opening).toBeLessThanOrEqual(1.7)
    }
    const p = door3dParams({ ...base(), ...DOOR3D_PRESETS.rue })
    expect([p.kind, p.oh]).toEqual([1, DOOR3D_PRESETS.rue.look.opening])
  })
})

describe('ouverture, silhouette et inclinaison', () => {
  it('l’inclinaison s’ajoute à l’angle sans le remplacer (jamais maître du pivot)', () => {
    const base = { angleDeg: 0, knockDeg: 0, width: 300, height: 475, shadows: true, look: DOOR3D_PRESETS.perron.look, light: DOOR3D_PRESETS.perron.light, interior: 0, mist: 0 }
    expect(door3dParams({ ...base, leanDeg: -5 }).angle).toBeCloseTo((-5 * Math.PI) / 180)
    expect(door3dParams({ ...base, angleDeg: 40, leanDeg: -5 }).angle).toBeCloseTo((35 * Math.PI) / 180)
    expect(door3dParams(base).angle).toBe(0)
  })

  it('l’ouverture suit la hauteur du lieu : la lueur intérieure ne déborde jamais du cadre', () => {
    const percents = (inset: string) => inset.split(' ').map((v) => Number.parseFloat(v))
    const [topPerron] = percents(door3dOpening(DOOR3D_PRESETS.perron.look).inset)
    const [topRue] = percents(door3dOpening(DOOR3D_PRESETS.rue.look).inset)
    expect(topPerron).toBeCloseTo(9.4, 0)
    expect(topRue).toBeGreaterThan(topPerron) // imposte : l’ouverture est plus basse
    const o = door3dOpening(DOOR3D_PRESETS.cimetiere.look)
    expect(o.radius).not.toBe('0') // arche en plein cintre
    expect(door3dOpening(DOOR3D_PRESETS.perron.look).radius).toBe('0')
    // Gonds et chant de l’ouverture, dans la boîte 120 × 190 : 15 et 105.
    expect(o.left).toBeCloseTo(15)
    expect(o.right).toBeCloseTo(105)
    expect(o.bottom).toBeLessThan(190)
  })

  it('la silhouette du cadre entoure l’ouverture, pour chaque lieu', () => {
    Object.values(DOOR3D_PRESETS).forEach(({ look }) => {
      const [sTop, sSide] = door3dSilhouette(look)
        .inset.split(' ')
        .map((v) => Number.parseFloat(v))
      const [oTop, oSide] = door3dOpening(look)
        .inset.split(' ')
        .map((v) => Number.parseFloat(v))
      expect(sTop).toBeLessThan(oTop)
      expect(sSide).toBeLessThan(oSide)
    })
  })
})

describe('createKnockSpring', () => {
  it('oscille sous 3 Hz (WCAG 2.3.1), s’amortit puis revient au repos', () => {
    expect(Math.sqrt(KNOCK_STIFFNESS - (KNOCK_DAMPING / 2) ** 2) / (2 * Math.PI)).toBeLessThan(3)
    const s = createKnockSpring()
    expect(s.step(1 / 60)).toBe(false)
    s.kick(1)
    expect(s.active).toBe(true)
    let peak = 0
    let t = 0
    while (s.step(1 / 60) && t < 5) {
      peak = Math.min(peak, s.x)
      t += 1 / 60
    }
    expect(peak).toBeLessThan(-2) // le battant sursaute vers nous
    expect(peak).toBeGreaterThan(-8)
    expect(t).toBeLessThan(2.5)
    expect(s.x).toBe(0)
    expect(s.active).toBe(false)
  })

  it('reste stable avec un pas grossier', () => {
    const s = createKnockSpring()
    s.kick(0.5)
    for (let i = 0; i < 200; i++) s.step(0.1)
    expect(s.active).toBe(false)
  })
})

describe('createDoor3d', () => {
  beforeEach(() => (loop.opts = null))

  it('rend à la demande : pause quand rien n’est dû, une image par demande', async () => {
    const state = { dirty: true }
    const canvas = { width: 300, height: 475 } as unknown as HTMLCanvasElement
    const params = vi.fn(() => ({ width: 300 }))
    await createDoor3d(canvas, { params, dirty: () => state.dirty, drawn: () => (state.dirty = false), resized: () => (state.dirty = true) })
    const o = loop.opts as { paused: () => boolean; setup: (g: unknown) => unknown; render: (f: unknown, s: unknown, c: unknown) => void; fps: number }
    expect(o.fps).toBe(60)
    expect(o.paused()).toBe(false)
    const s = o.setup({})
    const frame = { pass: vi.fn() }
    o.render(frame, s, { time: 0, deltaTime: 1 / 60 })
    expect(frame.pass).toHaveBeenCalledTimes(1)
    // Image dessinée : la boucle se met en pause (aucune boucle au repos) et une trame tardive n’encode rien.
    expect(o.paused()).toBe(true)
    o.render(frame, s, { time: 0, deltaTime: 1 / 60 })
    expect(frame.pass).toHaveBeenCalledTimes(1)
  })

  it('redessine si la taille du canevas change pendant le passage', async () => {
    const state = { dirty: true }
    const canvas = { width: 300, height: 150 } as { width: number; height: number }
    await createDoor3d(canvas as unknown as HTMLCanvasElement, { params: () => ({}), dirty: () => state.dirty, drawn: () => (state.dirty = false), resized: () => {} })
    const o = loop.opts as { setup: (g: unknown) => unknown; render: (f: unknown, s: unknown, c: unknown) => void }
    const s = o.setup({})
    o.render({ pass: () => (canvas.height = 475) }, s, { time: 0, deltaTime: 0 })
    expect(state.dirty).toBe(true)
    o.render({ pass: () => {} }, s, { time: 0, deltaTime: 0 })
    expect(state.dirty).toBe(false)
  })
})

describe('door3dDpr', () => {
  it('suit le niveau posé : high 1,5 ; medium 1,25 ; low 1', () => {
    expect(door3dDpr('high')).toEqual([1, 1.5])
    expect(door3dDpr('medium')).toEqual([1, 1.25])
    expect(door3dDpr('low')).toEqual([1, 1])
    expect(door3dDpr()).toEqual([1, 1.5])
  })
})
