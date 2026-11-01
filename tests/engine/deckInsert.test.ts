import { describe, expect, it } from 'vitest'
import { DECK_LAYERS, DECK_THICK, DECK_TILT, STOW_SCALE, cardRect, rectsOverlap } from '@/engine/deckFan'
import { INSERT_CARD_MS, INSERT_COVER_OFF_MS, INSERT_MS, INSERT_SIDE_GAP, INSERT_TOTAL_MS, insertPoses, pickSlot, projectDepth, slotDepth } from '@/engine/deckInsert'

const REPOS = { rx: DECK_TILT.x, ry: DECK_TILT.y, y: 0 }
// Poses extrêmes du paquet : respiration (±1,2°) et inclinaison du pointeur (±7°) ajoutées au repos.
const POSES = [REPOS, { rx: DECK_TILT.x + 8.2, ry: DECK_TILT.y - 8.2, y: 0.008 }, { rx: DECK_TILT.x - 8.2, ry: DECK_TILT.y + 8.2, y: -0.008 }]

describe('deckInsert : rang visé', () => {
  it('couvre tous les rangs, de 0 à DECK_LAYERS − 1, et reste borné même aux valeurs limites', () => {
    const rangs = Array.from({ length: 1000 }, (_, k) => pickSlot(k / 1000))
    expect(new Set(rangs).size).toBe(DECK_LAYERS)
    expect(Math.min(...rangs)).toBe(0)
    expect(Math.max(...rangs)).toBe(DECK_LAYERS - 1)
    expect(pickSlot(0)).toBe(0)
    expect(pickSlot(1)).toBe(DECK_LAYERS - 1) // jamais hors du paquet, même si rand vaut 1
    expect(pickSlot(-1)).toBe(0)
  })
  it('la profondeur du rang est entre les deux couches voisines, dans l’épaisseur du paquet', () => {
    const couche = (k: number) => ((k + 1) * DECK_THICK) / DECK_LAYERS // profondeur de la couche k, comme CardDeck
    for (let r = 0; r < DECK_LAYERS; r++) {
      expect(slotDepth(r)).toBeGreaterThan(r === 0 ? 0 : couche(r - 1)) // derrière la couche du dessus (ou le dos)
      expect(slotDepth(r)).toBeLessThan(couche(r)) // devant la couche du dessous
    }
  })
})

describe('deckInsert : projection de la tranche', () => {
  it('à profondeur nulle, rien ne bouge ; plus profond, la tranche descend et passe à droite, et rétrécit', () => {
    expect(projectDepth(0, DECK_TILT.x, DECK_TILT.y)).toEqual({ x: 0, y: 0, s: 1 })
    let prev = projectDepth(0, DECK_TILT.x, DECK_TILT.y)
    for (let r = 0; r < DECK_LAYERS; r++) {
      const p = projectDepth(slotDepth(r), DECK_TILT.x, DECK_TILT.y)
      expect(p.x).toBeGreaterThan(prev.x) // rotateY < 0 : vers la droite
      expect(p.y).toBeGreaterThan(prev.y) // rotateX > 0 : vers le bas
      expect(p.s).toBeLessThan(prev.s)
      expect(p.s).toBeGreaterThan(0.85) // perspective douce : la tranche ne rétrécit presque pas
      prev = p
    }
  })
})

describe('deckInsert : poses de la carte', () => {
  it('rentrée, la carte a l’échelle et l’inclinaison du paquet ; plus le rang est profond, plus elle est petite et décalée', () => {
    const w = 400
    let prev = insertPoses(0, REPOS, w).inside
    expect(prev.s).toBeCloseTo(STOW_SCALE, 1)
    expect(prev.rx).toBe(DECK_TILT.x)
    expect(prev.ry).toBe(DECK_TILT.y)
    for (let r = 1; r < DECK_LAYERS; r++) {
      const p = insertPoses(r, REPOS, w).inside
      expect(p.s).toBeLessThan(prev.s)
      expect(p.y).toBeGreaterThan(prev.y)
      expect(p.x).toBeGreaterThan(prev.x)
      prev = p
    }
  })
  it('la pose suit la largeur de la boîte et l’ondulation du paquet', () => {
    const a = insertPoses(5, REPOS, 300)
    const b = insertPoses(5, REPOS, 600)
    expect(b.inside.x).toBeCloseTo(a.inside.x * 2)
    expect(b.side.y).toBeCloseTo(a.side.y * 2)
    expect(insertPoses(5, { ...REPOS, y: 0.01 }, 300).inside.y - a.inside.y).toBeCloseTo(3) // 0,01 × 300
  })
  it('à côté du paquet, la carte ne chevauche ni le dessus, ni la tranche (jusqu’à la dernière couche), à tout rang, toute largeur et toute pose', () => {
    for (const w of [260, 340, 400, 560]) {
      for (const pose of POSES) {
        for (let r = 0; r < DECK_LAYERS; r++) {
          const { side } = insertPoses(r, pose, w)
          const carte = cardRect({ x: side.x, y: side.y, s: side.s, r: 0 }, w)
          const dessus = cardRect({ x: 0, y: pose.y * w, s: STOW_SCALE, r: 0 }, w)
          const fond = insertPoses(DECK_LAYERS - 1, pose, w).inside // la dernière couche : la plus décalée
          const tranche = cardRect({ x: fond.x, y: fond.y, s: fond.s, r: 0 }, w)
          expect(rectsOverlap(carte, dessus)).toBe(false)
          expect(rectsOverlap(carte, tranche)).toBe(false)
        }
      }
    }
  })
  it('le côté est à droite (le côté où la tranche se voit) et à la même hauteur que la pose rentrée : seul le translate bouge pendant le glissement', () => {
    const { side, inside } = insertPoses(7, REPOS, 400)
    expect(side.x).toBeGreaterThan(inside.x)
    expect(side.x - inside.x).toBeCloseTo((1 + INSERT_SIDE_GAP) * STOW_SCALE * 400)
    expect(side.y).toBe(inside.y)
    expect(side.s).toBe(inside.s)
    expect(side.rx).toBe(inside.rx)
    expect(side.ry).toBe(inside.ry)
  })
  it('rentrée, la carte recouvre le dessus du paquet à son décalage de tranche près : elle est entièrement cachée par la couche de recouvrement sauf un liseré', () => {
    const w = 400
    for (let r = 0; r < DECK_LAYERS; r++) {
      const { inside } = insertPoses(r, REPOS, w)
      const dessus = cardRect({ x: 0, y: 0, s: STOW_SCALE, r: 0 }, w)
      const carte = cardRect({ x: inside.x, y: inside.y, s: inside.s, r: 0 }, w)
      expect(carte.l).toBeGreaterThanOrEqual(dessus.l - 1) // son bord gauche et son bord haut restent sous le dessus
      expect(carte.t).toBeGreaterThanOrEqual(dessus.t - 1)
      expect(carte.r - dessus.r).toBeLessThan(0.1 * STOW_SCALE * w) // seul un liseré (la tranche) dépasse à droite et en bas
      expect(carte.b - dessus.b).toBeLessThan(0.2 * STOW_SCALE * w)
    }
  })
})

describe('deckInsert : durées', () => {
  it('la remise tient en 700 ms au plus, toutes les durées sont bornées et positives (usePresence libère toujours)', () => {
    expect(INSERT_TOTAL_MS).toBeLessThanOrEqual(700)
    Object.values(INSERT_MS).forEach((ms) => {
      expect(ms).toBeGreaterThan(0)
      expect(Number.isFinite(ms)).toBe(true)
    })
  })
  it('la couche de recouvrement ne s’éteint qu’après la fonte de la carte, et le paquet ne s’efface qu’après', () => {
    expect(INSERT_COVER_OFF_MS).toBeGreaterThan(INSERT_CARD_MS)
    expect(INSERT_TOTAL_MS).toBeGreaterThan(INSERT_COVER_OFF_MS)
    expect(INSERT_CARD_MS).toBe(INSERT_MS.approach + INSERT_MS.slide + INSERT_MS.melt)
  })
})
