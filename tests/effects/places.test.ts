import { describe, expect, it } from 'vitest'
import { placeLoaders } from '@/effects/places'
import { porchParams } from '@/effects/porch'
import type { RaymarchState } from '@/effects/raymarch'

const state = (over: Partial<RaymarchState & { variant: Record<string, number> }> = {}): RaymarchState & { variant?: Record<string, number> } => ({
  t: 12,
  width: 300,
  height: 200,
  paranoia: 0.3,
  motion: true,
  drift: 4,
  px: 0.1,
  py: -0.2,
  ...over,
})

describe('lieux : chargeurs paresseux', () => {
  it('chaque identifiant charge une configuration dont l’ambiance porte le même nom', async () => {
    for (const id of Object.keys(placeLoaders) as (keyof typeof placeLoaders)[]) {
      const cfg = await placeLoaders[id]()
      expect(cfg.ambience).toBe(id)
      expect(cfg.shader).toBeTruthy()
    }
  })
})

describe.each(Object.keys(placeLoaders) as (keyof typeof placeLoaders)[])('paramètres du lieu %s', (id) => {
  it('recopie temps, taille, paranoïa, dérive et parallaxe, tous des nombres finis', async () => {
    const { params } = await placeLoaders[id]()
    const p = params(state())
    expect(p.width).toBe(300)
    expect(p.height).toBe(200)
    expect(p.paranoia).toBe(0.3)
    expect(p.drift).toBe(4)
    expect(p.px).toBe(0.1)
    expect(p.py).toBe(-0.2)
    for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true)
  })

  it('mouvement réduit : plus de balancement de caméra', async () => {
    const { params } = await placeLoaders[id]()
    const p = params(state({ motion: false }))
    expect(p.sway).toBe(0)
    expect(p.swayY).toBe(0)
  })

  it('en mouvement, le balancement est non nul et croît avec la paranoïa', async () => {
    const { params } = await placeLoaders[id]()
    const calm = Math.abs(params(state({ t: 9, paranoia: 0 })).sway!)
    const tense = Math.abs(params(state({ t: 9, paranoia: 1 })).sway!)
    expect(calm).toBeGreaterThan(0)
    expect(tense).toBeGreaterThanOrEqual(calm * 0.5)
  })
})

describe('variantes des lieux', () => {
  it('perron : valeurs par défaut sans variante, valeurs de la variante sinon', () => {
    const d = porchParams(state())
    expect(d).toMatchObject({ mist: 1, moon: 1, rain: 0, leaves: 0, lamp: 0 })
    const v = porchParams(state({ variant: { mist: 0.2, moon: 0, rain: 1, leaves: 0.5, lamp: 1 } }))
    expect(v).toMatchObject({ mist: 0.2, moon: 0, rain: 1, leaves: 0.5, lamp: 1 })
  })

  it('perron : le loup-garou apparaît seulement à forte paranoïa', () => {
    expect(porchParams(state({ paranoia: 0.5 })).wolf).toBe(0)
    expect(porchParams(state({ paranoia: 0.7 })).wolf).toBeGreaterThan(0)
    expect(porchParams(state({ paranoia: 1 })).wolf).toBe(1)
  })

  it('forêt et cimetière : les yeux apparaissent après 0,45 de paranoïa', async () => {
    for (const id of ['foret', 'cimetiere'] as const) {
      const { params } = await placeLoaders[id]()
      expect(params(state({ paranoia: 0.4 })).eyes).toBe(0)
      expect(params(state({ paranoia: 0.9 })).eyes).toBe(1)
    }
  })

  it('forêt : neige de la variante ; cimetière : bruine de la variante', async () => {
    const foret = await placeLoaders.foret()
    expect(foret.params(state()).snow).toBe(0)
    expect(foret.params(state({ variant: { snow: 1 } })).snow).toBe(1)
    const cim = await placeLoaders.cimetiere()
    expect(cim.params(state()).rain).toBe(0)
    expect(cim.params(state({ variant: { rain: 0.7 } })).rain).toBe(0.7)
  })

  it('rue : image figée à t = 70 en mouvement réduit ; météo et fenêtres froides de la variante', async () => {
    const rue = await placeLoaders.rue()
    expect(rue.params(state({ motion: false, t: 3 })).time).toBe(70)
    expect(rue.params(state({ t: 3 })).time).toBe(3)
    expect(rue.params(state()).cold).toBe(0.2)
    expect(rue.params(state({ variant: { weather: 1, cold: 0.9 } }))).toMatchObject({ weather: 1, cold: 0.9 })
  })

  it('nuages : lune de sang et aube viennent de la variante', async () => {
    const n = await placeLoaders.nuages()
    expect(n.params(state())).toMatchObject({ blood: 0, dawn: 0 })
    expect(n.params(state({ variant: { blood: 1, dawn: 0.5 } }))).toMatchObject({ blood: 1, dawn: 0.5 })
  })
})
