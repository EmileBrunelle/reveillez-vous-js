import { describe, expect, it } from 'vitest'
import { KEY_STEP, RING_SIZE, WIN_RATIO, WIPE_RADIUS, clampToDisc, createCoverage, createWipeRing, decodeCell, packCoverage, spacedStamps, stampsAlong } from '../../src/effects/crystalMath'

describe('createWipeRing', () => {
  it('écrase le plus ancien point une fois plein', () => {
    const ring = createWipeRing(4)
    for (let i = 0; i < 6; i++) ring.add(i, 0, i)
    expect(ring.active().map((s) => s.x)).toEqual([2, 3, 4, 5])
  })
  it('emballe 8 points × 4 valeurs avec l’âge et l’indicateur actif', () => {
    const ring = createWipeRing()
    ring.add(0.5, -0.25, 1)
    const packed = ring.pack(3)
    expect(packed).toHaveLength(RING_SIZE * 4)
    expect(packed.slice(0, 4)).toEqual([0.5, -0.25, 2, 1])
    expect(packed.slice(4, 8)).toEqual([0, 0, 0, 0])
  })
  it('clear vide l’anneau', () => {
    const ring = createWipeRing()
    ring.add(0, 0, 0)
    ring.clear()
    expect(ring.active()).toEqual([])
  })
})

describe('stampsAlong / clampToDisc', () => {
  it('comble un long trajet sans dépasser l’espacement', () => {
    const pts = stampsAlong({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.1)
    expect(pts).toHaveLength(10)
    expect(pts.at(-1)).toEqual({ x: 1, y: 0 })
  })
  it('donne au moins un point', () => {
    expect(stampsAlong({ x: 0, y: 0 }, { x: 0, y: 0 }, 0.1)).toHaveLength(1)
  })
  it('ramène un point extérieur sur le cercle', () => {
    const p = clampToDisc(3, 4)
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(1)
    expect(clampToDisc(0.2, 0.1)).toEqual({ x: 0.2, y: 0.1 })
  })
})

describe('createCoverage', () => {
  it('compte environ π/4 des cellules', () => {
    const c = createCoverage(16)
    expect(c.total).toBeGreaterThan(180)
    expect(c.total).toBeLessThan(220)
    expect(c.ratio()).toBe(0)
  })
  it('atteint 70 % avec un balayage en lignes, pas avec un seul coup', () => {
    const c = createCoverage(16)
    c.mark(0, 0)
    expect(c.ratio()).toBeLessThan(0.2)
    for (let y = -1; y <= 1; y += 0.3) for (const p of stampsAlong({ x: -1, y }, { x: 1, y }, 0.1)) c.mark(p.x, p.y)
    expect(c.ratio()).toBeGreaterThan(0.7)
  })
  it('ne compte pas deux fois une cellule', () => {
    const c = createCoverage(16)
    c.mark(0, 0)
    const r = c.ratio()
    c.mark(0, 0)
    expect(c.ratio()).toBe(r)
  })
})

describe('spacedStamps', () => {
  it('pose le premier point tout de suite', () => {
    const r = spacedStamps(null, { x: 0.3, y: 0 }, 0.14)
    expect(r.points).toEqual([{ x: 0.3, y: 0 }])
  })
  it('ignore les micro-mouvements et reporte le reste', () => {
    let last = { x: 0, y: 0 }
    let total = 0
    for (let i = 1; i <= 100; i++) {
      const r = spacedStamps(last, { x: i * 0.01, y: 0 }, 0.14)
      total += r.points.length
      last = r.last
    }
    expect(total).toBe(7) // 1,0 de trajet / 0,14
    expect(last.x).toBeCloseTo(0.98)
  })
  it('un grand saut pose des points espacés exactement de `spacing`', () => {
    const r = spacedStamps({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 0.2)
    expect(r.points.map((p) => p.x)).toEqual([0.2, 0.4])
    expect(r.last.x).toBeCloseTo(0.4)
  })
})

describe('packCoverage / decodeCell', () => {
  it('aller-retour exact sur toute la grille 16 × 16', () => {
    const n = 16
    const wiped = Array.from({ length: n * n }, (_, k) => (k * 7 + (k >> 3)) % 3 === 0)
    const packed = packCoverage(wiped, n)
    expect(packed).toHaveLength(n)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) expect(decodeCell(packed, i, j, n)).toBe(wiped[j * n + i])
    expect(Math.max(...packed)).toBeLessThan(2 ** 16)
  })
  it('rangée pleine = 65535, hors grille = faux', () => {
    const packed = packCoverage(Array.from({ length: 256 }, () => true))
    expect(packed.every((r) => r === 65535)).toBe(true)
    expect(decodeCell(packed, 16, 0)).toBe(false)
    expect(decodeCell(packed, 0, -1)).toBe(false)
  })
  it('createCoverage.pack reflète les cellules marquées', () => {
    const c = createCoverage(16)
    c.mark(0, 0)
    const packed = c.pack()
    expect(decodeCell(packed, 8, 8)).toBe(true)
    expect(decodeCell(packed, 0, 0)).toBe(false)
  })
})

// Mesuré : 41 pressions (≈ 3 par seconde sur les 14 s) ; marge pour un tracé moins efficace.
const PRESSES_MAX = 60

describe('objectif au clavier', () => {
  // Le chiffon part du centre (0, 0), comme dans CrystalActivity ; chaque pression pose un point.
  const play = (rowStep: number) => {
    const cov = createCoverage()
    let x = 0
    let y = 0
    let presses = 0
    const press = (dx: number, dy: number) => {
      const p = clampToDisc(x + dx * KEY_STEP, y + dy * KEY_STEP)
      x = p.x
      y = p.y
      cov.mark(x, y)
      presses++
    }
    for (let k = 0; k < 4; k++) press(0, -1) // vers le haut de la boule
    let dir = -1
    while (cov.ratio() < WIN_RATIO && presses < 400) {
      for (let k = 0; k < 10 && cov.ratio() < WIN_RATIO; k++) press(dir, 0)
      for (let k = 0; k < rowStep && cov.ratio() < WIN_RATIO; k++) press(0, 1)
      dir = -dir
    }
    return { ratio: cov.ratio(), presses }
  }

  it('le pas d’une flèche ne dépasse pas le rayon d’essuyage (aucun trou entre deux points)', () => {
    expect(KEY_STEP).toBeLessThanOrEqual(WIPE_RADIUS)
  })

  it('un serpentin aux flèches depuis le centre atteint WIN_RATIO en un nombre raisonnable de pressions', () => {
    const { ratio, presses } = play(2)
    expect(ratio).toBeGreaterThanOrEqual(WIN_RATIO)
    expect(presses).toBeLessThan(PRESSES_MAX)
  })
})
