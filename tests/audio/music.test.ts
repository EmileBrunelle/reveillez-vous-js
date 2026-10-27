import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../src/engine/rng'
import {
  GAP_MAX,
  GAP_MIN,
  RESUME_MAX,
  RESUME_MIN,
  canStartPhrase,
  createMotif,
  createSession,
  musicGap,
  phraseDuration,
  planPhrase,
  releaseBusy,
  resumeDelay,
  validMotif,
  type NoteEvent,
  type PhraseGate,
} from '../../src/audio/musicPlan'

/** Notes de mélodie (sans écho ni main gauche, plus douce que 0,45). */
const melody = (p: NoteEvent[]) => p.filter((n) => !n.echo && n.velocity > 0.45)
const lastMelody = (p: NoteEvent[]) => melody(p).reduce((a, b) => (b.at > a.at ? b : a))

describe('motif de session', () => {
  it('a un contour conjoint : 4–6 notes, un saut au plus, fin ouverte, durées mêlées', () => {
    for (let s = 1; s <= 100; s++) {
      const m = createMotif(mulberry32(s))
      expect(m.degrees.length).toBeGreaterThanOrEqual(4)
      expect(m.degrees.length).toBeLessThanOrEqual(6)
      expect(validMotif(m)).toBe(true)
      const leaps = m.degrees.slice(1).filter((d, i) => Math.abs(d - m.degrees[i]) > 2).length
      expect(leaps).toBeLessThanOrEqual(1)
    }
  })
})

describe('planPhrase', () => {
  it('est déterministe pour un même Rng', () => {
    for (const l of [1, 3, 5]) expect(planPhrase(l, mulberry32(42))).toEqual(planPhrase(l, mulberry32(42)))
  })
  it('reste clairsemée et bornée', () => {
    for (let l = 1; l <= 5; l++)
      for (let s = 1; s <= 60; s++) {
        const p = planPhrase(l, mulberry32(s))
        expect(melody(p).length).toBeGreaterThanOrEqual(l === 5 ? 3 : 8)
        expect(p.filter((n) => !n.echo).length).toBeLessThanOrEqual(15)
        for (const n of p) {
          expect(n.midi).toBeGreaterThanOrEqual(43)
          expect(n.midi).toBeLessThanOrEqual(80)
          expect(n.velocity).toBeGreaterThan(0)
          expect(n.velocity).toBeLessThanOrEqual(1)
          expect(n.at).toBeGreaterThanOrEqual(0)
        }
        expect(phraseDuration(p)).toBeLessThan(45)
      }
  })
  it('finit sur la tonique ou la quinte, note tenue (niveaux 1–4)', () => {
    for (let l = 1; l <= 4; l++)
      for (let s = 1; s <= 60; s++) {
        const last = lastMelody(planPhrase(l, mulberry32(s)))
        expect([0, 7]).toContain((last.midi - 57) % 12)
        expect(last.decay).toBeGreaterThanOrEqual(7)
      }
  })
  it('avance surtout par degrés conjoints (≤ 4 demi-tons)', () => {
    let small = 0
    let total = 0
    for (let s = 1; s <= 60; s++) {
      const m = melody(planPhrase(1, mulberry32(s))).map((n) => n.midi)
      for (let i = 1; i < m.length; i++) {
        total++
        if (Math.abs(m[i] - m[i - 1]) <= 4) small++
      }
    }
    expect(small / total).toBeGreaterThan(0.8)
  })
  it('le motif revient d’une phrase à l’autre, sans jamais répéter la même phrase', () => {
    for (let s = 1; s <= 20; s++) {
      const r = mulberry32(s)
      const session = createSession(r)
      let prev = ''
      let firstPrev: number[] = []
      for (let i = 0; i < 12; i++) {
        const m = melody(planPhrase(1, r, session)).map((n) => n.midi)
        expect(m.join()).not.toBe(prev)
        prev = m.join()
        const first = m.slice(0, 3)
        if (i > 0) expect(first).toEqual(firstPrev)
        firstPrev = first
      }
    }
  })
  it('niveaux 1–2 propres, 3–4 désaccordés, 5 cassé', () => {
    for (let s = 1; s <= 30; s++) {
      expect(planPhrase(1, mulberry32(s)).every((n) => n.cents === 0 && n.sag === 0)).toBe(true)
      expect(planPhrase(2, mulberry32(s)).every((n) => n.cents === 0 && n.sag === 0)).toBe(true)
      const l4 = planPhrase(4, mulberry32(s))
      expect(l4.every((n) => Math.abs(n.cents) >= 15 && Math.abs(n.cents) <= 30 && n.sag === 0)).toBe(true)
      expect(planPhrase(5, mulberry32(s)).every((n) => n.sag < 0)).toBe(true)
    }
  })
  it('le niveau 5 diffère du niveau 1', () => {
    expect(planPhrase(5, mulberry32(7))).not.toEqual(planPhrase(1, mulberry32(7)))
  })
  it('le niveau 5 est le même air abîmé : mêmes temps, hauteurs à un demi-ton près, des notes tombées ou fausses', () => {
    let wrong = 0
    let dropped = 0
    for (let s = 1; s <= 80; s++) {
      const base = createSession(mulberry32(1000 + s))
      const a = melody(planPhrase(3, mulberry32(s), structuredClone(base)))
      const b = melody(planPhrase(5, mulberry32(s), structuredClone(base)))
      expect(b.length).toBeLessThanOrEqual(a.length)
      dropped += a.length - b.length
      for (const n of b) {
        const twin = a.find((x) => Math.abs(x.at - n.at) < 1e-9)
        expect(twin).toBeDefined()
        expect(Math.abs(twin!.midi - n.midi)).toBeLessThanOrEqual(1)
        if (twin!.midi !== n.midi) wrong++
      }
    }
    expect(wrong).toBeGreaterThan(0)
    expect(dropped).toBeGreaterThan(0)
  })
})

describe('musicGap', () => {
  it('reste entre 40 et 90 s', () => {
    const r = mulberry32(3)
    for (let i = 0; i < 500; i++) {
      const g = musicGap(r)
      expect(g).toBeGreaterThanOrEqual(GAP_MIN)
      expect(g).toBeLessThan(GAP_MAX)
    }
    expect(GAP_MIN).toBe(40)
    expect(GAP_MAX).toBe(90)
  })
})

describe('canStartPhrase', () => {
  const free: PhraseGate = {
    nowMs: 10_000,
    nextAtMs: 5_000,
    ctxTime: 20,
    motifBusyUntil: 0,
    stingerBusyUntil: 0,
    muted: false,
    hidden: false,
    ducked: false,
    running: true,
  }
  it('démarre quand tout est libre', () => expect(canStartPhrase(free)).toBe(true))
  it('attend l’heure prévue', () => expect(canStartPhrase({ ...free, nextAtMs: 10_001 })).toBe(false))
  it('ne démarre pas sur un leitmotif', () => {
    expect(canStartPhrase({ ...free, motifBusyUntil: 20.5 })).toBe(false)
    expect(canStartPhrase({ ...free, motifBusyUntil: 20 })).toBe(true)
  })
  it('ne démarre pas sur un jingle', () => expect(canStartPhrase({ ...free, stingerBusyUntil: 21 })).toBe(false))
  it('se tait en sourdine, onglet caché, finale ou contexte suspendu', () => {
    for (const k of ['muted', 'hidden', 'ducked'] as const) expect(canStartPhrase({ ...free, [k]: true })).toBe(false)
    expect(canStartPhrase({ ...free, running: false })).toBe(false)
  })
})

describe('resumeDelay', () => {
  it('reste entre 8 et 20 s', () => {
    const r = mulberry32(9)
    for (let i = 0; i < 300; i++) {
      const d = resumeDelay(r)
      expect(d).toBeGreaterThanOrEqual(RESUME_MIN)
      expect(d).toBeLessThan(RESUME_MAX)
    }
  })
})

describe('releaseBusy', () => {
  it('rabaisse sa propre valeur', () => expect(releaseBusy(30, 30, 5)).toBe(5))
  it('ne rabaisse jamais la valeur d’un autre', () => expect(releaseBusy(42, 30, 5)).toBe(42))
})
