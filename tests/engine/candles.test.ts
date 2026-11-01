import { describe, expect, it } from 'vitest'
import {
  COUNT,
  DRAFT_DELAY_MS,
  DRAFT_FIRE_MIN_LEFT_MS,
  DRAFT_MIN_LEFT_MS,
  HOLD_MS,
  RELIGHT_MS,
  advanceHold,
  advanceHolds,
  allLit,
  autoRelights,
  hasDraft,
  initCandles,
  isNearWick,
  lightCandle,
  litCount,
  pickSnuffed,
  relightSnuffed,
  resetHolds,
  snuffStep,
  type CandlesState,
} from '@/engine/candles'
import { durationOf } from '@/engine/activityTiming'
import { mulberry32 } from '@/engine/rng'

const LONG = 16_000
// Allume les candidates `ids` (temps restant confortable) et rend l’état.
const allumer = (level: number, ids: number[], leftMs = LONG): CandlesState => ids.reduce((s, i) => lightCandle(s, i, level, leftMs).state, initCandles(level))

describe('progression d’allumage', () => {
  it('allume après HOLD_MS de contact', () => {
    let p = 0
    for (let t = 0; t < HOLD_MS; t += 100) p = advanceHold(p, true, 100)
    expect(p).toBeCloseTo(1, 6)
  })
  it('retombe sans contact, sans passer sous 0', () => {
    expect(advanceHold(0.5, false, 100)).toBeLessThan(0.5)
    expect(advanceHold(0.01, false, 1000)).toBe(0)
  })
  it('un contact bref (moins de HOLD_MS) n’allume pas', () => {
    expect(advanceHold(0, true, HOLD_MS - 100)).toBeLessThan(1)
  })
  it('détecte la proximité', () => {
    expect(isNearWick(0, 0, 3, 4, 5)).toBe(true)
    expect(isNearWick(0, 0, 3, 4, 4.9)).toBe(false)
  })
})

describe('règles par niveau', () => {
  it('le courant d’air existe dès le niveau 3', () => {
    expect([1, 2, 3, 4, 5].map(hasDraft)).toEqual([false, false, true, true, true])
  })
  it('le rallumage automatique s’arrête au niveau 3 : dès le 4, à la main', () => {
    expect([3, 4, 5].map(autoRelights)).toEqual([true, false, false])
  })
  it('l’état initial est éteint ; aux niveaux 1 et 2 le courant d’air est déjà « passé »', () => {
    const s = initCandles(3)
    expect(s.lit).toEqual([false, false, false])
    expect(s.hold).toEqual([0, 0, 0])
    expect(s.snuffed).toBe(-1)
    expect(s.draftUsed).toBe(false)
    expect(initCandles(2).draftUsed).toBe(true)
    expect(litCount(s)).toBe(0)
    expect(allLit(s)).toBe(false)
  })
})

describe('advanceHolds', () => {
  it('monte sur la mèche touchée et signale celle qui arrive à 1', () => {
    let s = initCandles(1)
    let reached: number[] = []
    for (let t = 0; t < HOLD_MS && !reached.length; t += 50) ({ state: s, reached } = advanceHolds(s, [false, true, false], 50))
    expect(reached).toEqual([1])
    expect(s.hold[0]).toBe(0)
    expect(s.hold[1]).toBe(1)
  })
  it('n’allume pas avant HOLD_MS', () => {
    const { reached } = advanceHolds(initCandles(1), [true, false, false], HOLD_MS - 50)
    expect(reached).toEqual([])
  })
  it('rend le même état s’il ne se passe rien (aucun rendu inutile)', () => {
    const s = initCandles(1)
    expect(advanceHolds(s, [false, false, false], 16).state).toBe(s)
  })
  it('ne touche pas aux chandelles allumées', () => {
    const s = allumer(1, [0])
    const r = advanceHolds(s, [true, false, false], 1000)
    expect(r.state.hold[0]).toBe(0)
    expect(r.reached).toEqual([])
  })
  it('resetHolds remet les progressions à zéro (même état s’il n’y a rien à remettre)', () => {
    const { state } = advanceHolds(initCandles(1), [true, false, true], 300)
    expect(resetHolds(state).hold).toEqual([0, 0, 0])
    const s = initCandles(1)
    expect(resetHolds(s)).toBe(s)
  })
})

describe('lightCandle', () => {
  it('allume une chandelle, remet sa progression à zéro (pas de doublon avec « allumée »)', () => {
    const avance = advanceHolds(initCandles(3), [true, false, false], 300).state
    const r = lightCandle(avance, 0, 3, LONG)
    expect(r.step).toBe('lit')
    expect(r.state.lit).toEqual([true, false, false])
    expect(r.state.hold[0]).toBe(0)
  })
  it('ignore une chandelle déjà allumée ou un indice hors de la rangée', () => {
    const s = allumer(3, [0])
    expect(lightCandle(s, 0, 3, LONG).step).toBe('none')
    expect(lightCandle(s, 5, 3, LONG).step).toBe('none')
    expect(lightCandle(s, -1, 3, LONG).step).toBe('none')
  })
  it('niveaux 1 et 2 : la troisième donne la victoire', () => {
    for (const level of [1, 2]) expect(lightCandle(allumer(level, [0, 1]), 2, level, LONG).step).toBe('win')
  })
  it('niveau 3 et plus : la troisième arme le courant d’air', () => {
    for (const level of [3, 4, 5]) {
      const r = lightCandle(allumer(level, [0, 1]), 2, level, LONG)
      expect(r.step).toBe('draft')
      expect(r.state.draftUsed).toBe(true)
    }
  })
  it('la troisième allumée tard (moins de DRAFT_MIN_LEFT_MS) est une victoire immédiate, sans courant d’air', () => {
    for (const level of [3, 4, 5]) {
      expect(lightCandle(allumer(level, [0, 1]), 2, level, DRAFT_MIN_LEFT_MS - 1).step).toBe('win')
      expect(lightCandle(allumer(level, [0, 1]), 2, level, 450).step).toBe('win')
      expect(lightCandle(allumer(level, [0, 1]), 2, level, DRAFT_MIN_LEFT_MS).step).toBe('draft')
    }
  })
  it('le courant d’air n’arrive qu’une fois : rallumer la chandelle soufflée donne la victoire', () => {
    const armed = lightCandle(allumer(3, [0, 1]), 2, 3, LONG).state
    const { state } = snuffStep(armed, mulberry32(1), new Set(), LONG)
    expect(state.snuffed).toBeGreaterThanOrEqual(0)
    const r = lightCandle(state, state.snuffed, 3, LONG)
    expect(r.step).toBe('win')
    expect(r.state.snuffed).toBe(-1)
    expect(allLit(r.state)).toBe(true)
  })
})

describe('snuffStep et pickSnuffed', () => {
  const armed = (level = 3) => lightCandle(allumer(level, [0, 1]), 2, level, LONG).state

  it('souffle une chandelle allumée et la mémorise', () => {
    const { state, step } = snuffStep(armed(), mulberry32(7), new Set(), LONG)
    expect(step).toBe('snuffed')
    expect(litCount(state)).toBe(2)
    expect(state.lit[state.snuffed]).toBe(false)
    expect(state.hold[state.snuffed]).toBe(0)
  })
  it('n’éteint jamais une chandelle protégée', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { state } = snuffStep(armed(), mulberry32(seed), new Set([0, 2]), LONG)
      expect(state.snuffed).toBe(1)
    }
  })
  it('toutes protégées : on réessaie (retry), l’état ne change pas', () => {
    const s = armed()
    const r = snuffStep(s, mulberry32(1), new Set([0, 1, 2]), LONG)
    expect(r.step).toBe('retry')
    expect(r.state).toBe(s)
  })
  it('toutes protégées et trop peu de temps : victoire, plus de relance', () => {
    const s = armed()
    const r = snuffStep(s, mulberry32(1), new Set([0, 1, 2]), DRAFT_FIRE_MIN_LEFT_MS - 1)
    expect(r.step).toBe('win')
    expect(r.state).toBe(s)
  })
  it('trop peu de temps pour rallumer : victoire même si aucune n’est protégée', () => {
    expect(snuffStep(armed(), mulberry32(1), new Set(), 1000).step).toBe('win')
  })
  it('ne choisit qu’une chandelle allumée', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 20; i++) expect([0, 2]).toContain(pickSnuffed([true, false, true], rng))
    expect(pickSnuffed([false, false, false], rng)).toBe(-1)
  })
  it('renvoie -1 si toutes les allumées sont protégées', () => {
    expect(pickSnuffed([true, false, false], mulberry32(1), new Set([0]))).toBe(-1)
  })
  it('le tirage suit le Rng injecté (même graine, même chandelle)', () => {
    expect(snuffStep(armed(), mulberry32(11), new Set(), LONG).state.snuffed).toBe(snuffStep(armed(), mulberry32(11), new Set(), LONG).state.snuffed)
  })
})

describe('relightSnuffed (niveau 3)', () => {
  it('rallume la chandelle soufflée et donne la victoire', () => {
    const { state } = snuffStep(lightCandle(allumer(3, [0, 1]), 2, 3, LONG).state, mulberry32(3), new Set(), LONG)
    const r = relightSnuffed(state)
    expect(r.step).toBe('win')
    expect(r.state.snuffed).toBe(-1)
    expect(allLit(r.state)).toBe(true)
  })
  it('rien à rallumer sans chandelle soufflée', () => {
    const s = allumer(3, [0])
    expect(relightSnuffed(s)).toEqual({ state: s, step: 'none' })
  })
})

// Simulation d’un joueur au pointeur (déterministe) : il va à la première chandelle éteinte (trajet), la tient HOLD_MS, passe à la suivante.
// Le courant d’air et le rallumage automatique suivent les minuteries du composant. Rend l’instant de la victoire (ms), null si échec.
const DUREE = durationOf('candles')
const simuler = (level: number, seed: number, { trajet = 400, repere = 500 }: { trajet?: number; repere?: number } = {}) => {
  const rng = mulberry32(seed)
  let s = initCandles(level)
  let draftAt = -1
  let relightAt = -1
  let target = -1
  let arriveAt = 0
  let snuffedAt = -1
  for (let t = 0; t < DUREE; t += 16) {
    if (draftAt >= 0 && t >= draftAt) {
      draftAt = -1
      const r = snuffStep(s, rng, new Set(), DUREE - t)
      s = r.state
      if (r.step === 'win') return t
      if (r.step === 'retry') draftAt = t + DRAFT_DELAY_MS
      else {
        snuffedAt = t
        if (autoRelights(level)) relightAt = t + RELIGHT_MS
      }
    }
    if (relightAt >= 0 && t >= relightAt) {
      relightAt = -1
      const r = relightSnuffed(s)
      s = r.state
      if (r.step === 'win') return t
    }
    // Le joueur ne remarque une chandelle soufflée qu’après `repere` ms.
    const attend = s.snuffed >= 0 && t < snuffedAt + repere
    const prochaine = attend ? -1 : s.lit.findIndex((on) => !on)
    if (prochaine !== target) {
      target = prochaine
      arriveAt = t + trajet
    }
    const touching = s.lit.map((_, i) => i === target && t >= arriveAt)
    const { state, reached } = advanceHolds(s, touching, 16)
    s = state
    for (const i of reached) {
      const r = lightCandle(s, i, level, DUREE - t)
      s = r.state
      if (r.step === 'win') return t
      if (r.step === 'draft') draftAt = t + DRAFT_DELAY_MS
      if (s.snuffed < 0) snuffedAt = -1
    }
  }
  return null
}

describe('simulation : le jeu est gagnable, mais pas sans effort', () => {
  it('un joueur raisonnable gagne aux niveaux 1 à 5 dans la durée allouée (50 graines chacun)', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      for (let seed = 1; seed <= 50; seed++) {
        const t = simuler(level, seed)
        expect(t, `niveau ${level}, graine ${seed}`).not.toBeNull()
        expect(t!).toBeLessThan(DUREE)
      }
    }
  })
  it('même lent (trajets de 1,2 s, 1,5 s pour remarquer) il gagne au niveau 5 avec de la marge', () => {
    for (let seed = 1; seed <= 50; seed++) expect(simuler(5, seed, { trajet: 1200, repere: 1500 })).not.toBeNull()
  })
  it('trois mèches tenues HOLD_MS : aucune victoire avant 3 × HOLD_MS (plus de victoire en trois taps)', () => {
    for (const level of [1, 3, 5]) expect(simuler(level, 1, { trajet: 0 })!).toBeGreaterThanOrEqual(COUNT * HOLD_MS - 32)
  })
  it('aux niveaux 4 et 5, la chandelle soufflée n’est jamais rallumée seule : sans geste du joueur, pas de victoire', () => {
    const armed = lightCandle(allumer(5, [0, 1]), 2, 5, LONG).state
    let s = snuffStep(armed, mulberry32(2), new Set(), LONG).state
    expect(autoRelights(5)).toBe(false)
    // Aucune minuterie n’est armée : l’état reste tel quel.
    s = advanceHolds(s, [false, false, false], 10_000).state
    expect(litCount(s)).toBe(2)
  })
  it('jamais d’échec avec les trois chandelles allumées : la dernière allumée à n’importe quel moment finit en victoire', () => {
    // La dernière est allumée au clavier (instantané) à l’instant `dernier` ; un joueur qui rallume en 1,5 s après un courant d’air gagne toujours.
    for (const level of [3, 4, 5]) {
      for (let seed = 1; seed <= 20; seed++) {
        for (let dernier = 0; dernier < DUREE; dernier += 250) {
          const rng = mulberry32(seed)
          let s = allumer(level, [0, 1])
          const r = lightCandle(s, 2, level, DUREE - dernier)
          s = r.state
          let gagne = r.step === 'win'
          if (r.step === 'draft') {
            const t = dernier + DRAFT_DELAY_MS
            const sn = snuffStep(s, rng, new Set(), DUREE - t)
            gagne = sn.step === 'win' || DUREE - (t + 1500) > 0
          }
          expect(gagne, `niveau ${level}, dernière à ${dernier} ms`).toBe(true)
        }
      }
    }
  })
  it('constantes cohérentes : armer exige de quoi attendre le courant d’air et rallumer', () => {
    expect(DRAFT_MIN_LEFT_MS).toBeGreaterThan(DRAFT_DELAY_MS + RELIGHT_MS)
    expect(DRAFT_FIRE_MIN_LEFT_MS).toBeGreaterThan(RELIGHT_MS)
  })
})
