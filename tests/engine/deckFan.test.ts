import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/engine/rng'
import {
  DECK_LAYERS,
  DECK_PERSP,
  DECK_THICK,
  DECK_TILT,
  FAN_PERSP,
  FAN_SCALE,
  PILE_LIFE,
  STOW_END_SCALE,
  STOW_SCALE,
  FAN_STACK,
  dealRankOf,
  dealStartOf,
  deckPose,
  drawPileOrder,
  promoteMiddle,
  stackOfPile,
  stowDelay,
  stowFrac,
  stowOf,
} from '@/engine/deckFan'

describe('deckFan : pile de rangement sur le dessus du paquet', () => {
  it('la pile est au centre de la boîte (dessus du paquet), plus petite que l’éventail, légèrement décalée carte par carte', () => {
    const pts = [0, 1, 2].map((i) => stowOf(i, 300))
    pts.forEach((p) => {
      expect(Math.abs(p.y)).toBeLessThan(0.05 * 300) // au centre, pas en bas près de la légende
      expect(p.s).toBe(STOW_SCALE)
      expect(p.s).toBeLessThan(FAN_SCALE)
      expect(Math.abs(p.x)).toBeLessThan(10) // une pile serrée, pas un second éventail
    })
    expect(new Set(pts.map((p) => p.x)).size).toBe(3) // chaque carte a son décalage
    expect(new Set(pts.map((p) => p.r)).size).toBe(3)
    expect(stowOf(1, 300)).toMatchObject({ x: 0, y: 0 }) // la carte du milieu, au sommet, et la carte de lecture se rangent sur le centre du dessus
  })
  it('la donne part d’où le rangement arrive : les cartes ressortent du dessus du paquet', () => {
    ;[0, 1, 2].forEach((i) => expect(dealStartOf(i, 300)).toEqual(stowOf(i, 300)))
    ;[0, 1, 2].forEach((i) => expect(stowOf(i, 100).x).toBeCloseTo(stowFrac(i).x * 100))
  })
  it('la pile recule en s’effaçant (échelle plus petite) sans disparaître d’un coup, et reste vivante', () => {
    expect(STOW_END_SCALE).toBeLessThan(STOW_SCALE)
    expect(STOW_END_SCALE).toBeGreaterThan(0)
    expect(PILE_LIFE).toBeGreaterThan(0) // jamais d’immobilité totale
    expect(PILE_LIFE).toBeLessThan(1) // mais plus faible que dans l’éventail
  })
  it('le paquet 3D : tranche épaisse en couches, inclinaison de repos douce, perspective plus douce que celle de l’éventail', () => {
    expect(DECK_LAYERS).toBeGreaterThanOrEqual(8)
    expect(DECK_THICK).toBeGreaterThan(0)
    expect(DECK_TILT.x).toBeGreaterThan(0) // le haut recule : la tranche descend
    expect(DECK_TILT.y).toBeLessThan(0) // la tranche passe à droite
    expect(Math.abs(DECK_TILT.x)).toBeLessThan(30)
    expect(DECK_PERSP).toBeGreaterThan(FAN_PERSP)
  })
  it('la pose partagée du paquet part de son inclinaison de repos', () => {
    expect(deckPose).toEqual({ rx: DECK_TILT.x, ry: DECK_TILT.y, y: 0 })
  })
  it('les cibles suivent la largeur de la boîte', () => {
    expect(stowOf(0, 600).y).toBeCloseTo(stowOf(0, 300).y * 2)
  })
  it('départ échelonné : la carte avant le choix part d’abord, le milieu un demi-pas après', () => {
    expect(stowDelay(0, 2, 90)).toBe(90)
    expect(stowDelay(1, 2, 90)).toBe(90 + 35)
    expect(stowDelay(2, 0, 90)).toBe(90 + 70)
    expect(stowDelay(1, 0, 90)).toBe(90 + 105)
  })
})

import { EXIT_SHIFT, cardRect, rectsOverlap, FAN } from '@/engine/deckFan'

describe('deckFan : séparation avant changement d’ordre', () => {
  const W = 300
  const box = (i: number, dx = 0) => cardRect({ x: (FAN[i].x / 100) * W + dx, y: (FAN[i].y / 100) * W, s: FAN_SCALE, r: FAN[i].rot }, W)
  it('au repos, la carte du milieu recouvre les cartes latérales', () => {
    expect(rectsOverlap(box(2), box(1))).toBe(true)
    expect(rectsOverlap(box(0), box(1))).toBe(true)
  })
  it('après la sortie latérale, la carte du dessous est séparée de la carte du milieu', () => {
    expect(rectsOverlap(box(2, EXIT_SHIFT * W), box(1))).toBe(false)
    expect(rectsOverlap(box(0, -EXIT_SHIFT * W), box(1))).toBe(false)
  })
  it('la rotation agrandit la boîte englobante', () => {
    const droite = cardRect({ x: 0, y: 0, s: 0.5, r: 0 }, W)
    const penchee = cardRect({ x: 0, y: 0, s: 0.5, r: 10 }, W)
    expect(penchee.r - penchee.l).toBeGreaterThan(droite.r - droite.l)
  })
  it('des rectangles qui se touchent seulement par un bord ne se recouvrent pas', () => {
    expect(rectsOverlap({ l: 0, r: 10, t: 0, b: 10 }, { l: 10, r: 20, t: 0, b: 10 })).toBe(false)
  })
})

import { depthOf, shadowOf } from '@/engine/deckFan'

describe('deckFan : profondeur et ombre', () => {
  it('la profondeur suit l’échelle, bornée entre la pile (0) et la carte du tirage (1)', () => {
    expect(depthOf(STOW_SCALE)).toBe(0)
    expect(depthOf(1)).toBe(1)
    expect(depthOf(0.1)).toBe(0)
    expect(depthOf(2)).toBe(1)
    expect(depthOf(FAN_SCALE)).toBeGreaterThan(0)
  })
  it('plus la carte est haute, plus son ombre est décalée, large et pâle', () => {
    const bas = shadowOf(0, 300)
    const haut = shadowOf(1, 300)
    expect(haut.y).toBeGreaterThan(bas.y)
    expect(haut.s).toBeGreaterThan(bas.s)
    expect(haut.o).toBeLessThan(bas.o)
    expect(bas.o).toBeLessThan(1) // jamais de noir opaque
  })
})

import { clampExitX } from '@/engine/deckFan'

describe('deckFan : sortie bornée au viewport', () => {
  // boîte centrée à 192 px dans un viewport de 384 px, carte de 80 px de demi-largeur, marge 10
  it('ne borne pas quand il y a la place', () => expect(clampExitX(50, 192, 384, 80, 10)).toBe(50))
  it('borne à droite et à gauche', () => {
    expect(clampExitX(300, 192, 384, 80, 10)).toBe(384 - 80 - 10 - 192)
    expect(clampExitX(-300, 192, 384, 80, 10)).toBe(80 + 10 - 192)
  })
  it('viewport trop étroit : pas de décalage plutôt qu’un bornage inversé', () => expect(clampExitX(100, 50, 100, 80, 10)).toBe(0))
})

describe('deckFan : sommet de la pile tiré au hasard à la donne', () => {
  it('sur 300 donnes, chaque place finale (gauche, milieu, droite) reçoit le sommet environ 1 fois sur 3', () => {
    const rng = mulberry32(2026)
    const tops = [0, 0, 0]
    for (let n = 0; n < 300; n++) tops[drawPileOrder(rng)[0]]++
    tops.forEach((t) => {
      expect(t / 300).toBeGreaterThanOrEqual(0.25)
      expect(t / 300).toBeLessThanOrEqual(0.42)
    })
  })

  it('le sommet part en premier ; le tirage est une permutation', () => {
    const rng = mulberry32(5)
    for (let n = 0; n < 50; n++) {
      const order = drawPileOrder(rng)
      expect([...order].sort()).toEqual([0, 1, 2])
      expect(dealRankOf(order)[order[0]]).toBe(0)
      expect(stackOfPile(order)[2]).toBe(order[0]) // le sommet est le plus haut en z
    }
  })

  it('aucune permutation de z en plein chevauchement ; la carte du milieu finit devant dès que les rectangles se séparent', () => {
    const rng = mulberry32(99)
    for (let n = 0; n < 300; n++) {
      const start = stackOfPile(drawPileOrder(rng))
      expect(promoteMiddle(start, () => false)).toBe(start) // chevauchement : rien ne bouge, même liste
      let stack: readonly number[] = start
      for (let k = 0; k < 3; k++) stack = promoteMiddle(stack, () => true)
      expect(stack[2]).toBe(1)
      expect([...stack].sort()).toEqual([0, 1, 2])
    }
    expect(promoteMiddle(FAN_STACK, () => true)).toBe(FAN_STACK) // déjà devant : inchangé
  })

  it('un échange à la fois : jamais par-dessus une carte qui recouvre encore la carte du milieu', () => {
    const stack: readonly number[] = [1, 0, 2] // le milieu au fond : 0 juste au-dessus, 2 tout en haut
    expect(promoteMiddle(stack, (j) => j === 2)).toBe(stack) // 2 est séparée mais 0 recouvre encore
    expect(promoteMiddle(stack, (j) => j === 0)).toEqual([0, 1, 2])
  })
})
