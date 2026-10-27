import { describe, expect, it } from 'vitest'
import { PIANO_PHRASES } from '../../src/content/pianoPhrases'
import { mulberry32 } from '../../src/engine/rng'
import { KEYS, perform } from '../../src/audio/musicPlan'
import { MAX_RINGING, notePartials, peakSources, stealCuts } from '../../src/audio/pianoVoice'

/** Plafond de sources audio (oscillateurs + marteaux + flottement) simultanées : budget d’un téléphone d’entrée de gamme. */
const MAX_SOURCES = 60

describe('coût du piano', () => {
  it(`jamais plus de ${MAX_SOURCES} sources simultanées, quels que soient la phrase, le niveau et la tonalité`, () => {
    for (const p of PIANO_PHRASES) {
      for (const level of [1, 2, 3, 4, 5]) {
        for (const key of [KEYS.A, KEYS['F#m'], KEYS.Am]) {
          for (let seed = 1; seed <= 6; seed++) {
            const peak = peakSources(perform(p, key, level, mulberry32(seed)))
            expect(peak, `${p.name} niveau ${level} graine ${seed}`).toBeLessThanOrEqual(MAX_SOURCES)
          }
        }
      }
    }
  })
  it('les partiels aigus s’éteignent avant la fin de la note (enveloppe sous le seuil)', () => {
    const parts = notePartials({ hz: 220, velocity: 0.7, decay: 8, voice: 'melody' }, 8)
    const stops = parts.map((p) => p.stop)
    expect(stops[0]).toBeGreaterThan(stops[stops.length - 1])
    expect(parts.some((p) => p.stop < p.natural)).toBe(true)
    for (const p of parts) expect(p.stop).toBeLessThanOrEqual(p.natural)
  })
  it('étouffe la plus ancienne note quand plus de MAX_RINGING sonnent', () => {
    const note = (at: number) => ({ at, hz: 220, midi: 57, velocity: 0.6, decay: 20, release: 100, voice: 'inner', cents: 0, sag: 0 }) as never
    const notes = Array.from({ length: MAX_RINGING + 2 }, (_, i) => note(i))
    const cuts = stealCuts(notes)
    expect(cuts[0]).toBeLessThanOrEqual(MAX_RINGING)
    expect(cuts[cuts.length - 1]).toBe(Infinity)
    expect(cuts.filter((c) => c === Infinity).length).toBeGreaterThanOrEqual(MAX_RINGING - 1)
  })
})
