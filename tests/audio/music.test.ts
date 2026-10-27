import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../src/engine/rng'
import { GAP_MAX, GAP_MIN, canStartPhrase, musicGap, phraseDuration, planPhrase, type PhraseGate } from '../../src/audio/musicPlan'

const primary = (level: number, seed: number) => planPhrase(level, mulberry32(seed)).filter((n) => !n.echo)

describe('planPhrase', () => {
  it('est déterministe pour un même Rng', () => {
    for (const l of [1, 3, 5]) expect(planPhrase(l, mulberry32(42))).toEqual(planPhrase(l, mulberry32(42)))
  })
  it('reste clairsemée et bornée', () => {
    for (let l = 1; l <= 5; l++)
      for (let s = 1; s <= 60; s++) {
        const p = planPhrase(l, mulberry32(s))
        const notes = p.filter((n) => !n.echo)
        expect(notes.length).toBeGreaterThanOrEqual(l === 5 ? 3 : 4)
        expect(notes.length).toBeLessThanOrEqual(l <= 2 ? 18 : 12)
        for (const n of p) {
          expect(n.midi).toBeGreaterThanOrEqual(43)
          expect(n.midi).toBeLessThanOrEqual(80)
          expect(n.velocity).toBeGreaterThan(0)
          expect(n.velocity).toBeLessThanOrEqual(1)
          expect(n.at).toBeGreaterThanOrEqual(0)
        }
        expect(phraseDuration(p)).toBeLessThan(40)
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
  it('le niveau 5 contient des notes hors gamme sur l’ensemble des graines', () => {
    const dark = new Set([0, 3, 5, 7, 10, 12].map((x) => x % 12))
    const off = Array.from({ length: 80 }, (_, s) => primary(5, s + 1)).some((p) => p.some((n) => !dark.has((n.midi - 45) % 12)))
    expect(off).toBe(true)
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
