import { describe, expect, it } from 'vitest'
import { copyVec4, crtStaticKey, crystalScalarsChanged, makeVec4Fields, raymarchStaticKey } from '../../src/effects/frameSkip'

describe('clés d’image statique', () => {
  it('CRT : même taille et paranoïa à 3 décimales près = même clé', () => {
    expect(crtStaticKey(540, 270, 0.4001)).toBe(crtStaticKey(540, 270, 0.4004))
    expect(crtStaticKey(540, 270, 0.4)).not.toBe(crtStaticKey(540, 270, 0.402))
    expect(crtStaticKey(540, 270, 0.4)).not.toBe(crtStaticKey(541, 270, 0.4))
  })

  it('fond raymarché : la variante change la clé', () => {
    expect(raymarchStaticKey(540, 270, 0.4, 'a=1.000')).toBe(raymarchStaticKey(540, 270, 0.4, 'a=1.000'))
    expect(raymarchStaticKey(540, 270, 0.4, 'a=1.000')).not.toBe(raymarchStaticKey(540, 270, 0.4, 'a=2.000'))
    expect(raymarchStaticKey(540, 270, 0.4, 'a')).not.toBe(raymarchStaticKey(540, 280, 0.4, 'a'))
  })
})

describe('copyVec4', () => {
  it('copie sans réallouer et signale les changements seulement', () => {
    const fields = makeVec4Fields({ time: 0 }, 2, 1)
    const p0 = fields.p0
    expect(copyVec4(fields, 'p', 2, [1, 2, 3, 4, 5, 6, 7, 8])).toBe(true)
    expect(fields.p0).toBe(p0) // même tableau, muté en place
    expect(fields.p1).toEqual([5, 6, 7, 8])
    expect(copyVec4(fields, 'p', 2, [1, 2, 3, 4, 5, 6, 7, 8])).toBe(false)
    expect(copyVec4(fields, 'p', 2, [1, 2, 3, 4, 5, 6, 7, 9])).toBe(true)
  })

  it('les valeurs absentes valent 0', () => {
    const fields = makeVec4Fields({}, 1, 1)
    copyVec4(fields, 'g', 1, [9, 9, 9, 9])
    expect(copyVec4(fields, 'g', 1, [])).toBe(true)
    expect(fields.g0).toEqual([0, 0, 0, 0])
  })
})

describe('crystalScalarsChanged', () => {
  const last = { drawn: true, size: '300x300', done: 0.5, motion: 0 }
  it('rien de changé après une première image', () => {
    expect(crystalScalarsChanged(last, '300x300', 0.5, false)).toBe(false)
  })
  it('première image, taille, dissipation ou bascule de mouvement', () => {
    expect(crystalScalarsChanged({ ...last, drawn: false }, '300x300', 0.5, false)).toBe(true)
    expect(crystalScalarsChanged(last, '320x320', 0.5, false)).toBe(true)
    expect(crystalScalarsChanged(last, '300x300', 0.6, false)).toBe(true)
    expect(crystalScalarsChanged(last, '300x300', 0.5, true)).toBe(true)
  })
})
