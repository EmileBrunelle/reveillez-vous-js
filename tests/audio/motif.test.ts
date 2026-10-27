import { beforeEach, describe, expect, it } from 'vitest'
import { muted } from '../../src/audio/sfx'
import { HYMN_HZ, FLIP_BLIP_HZ } from '../../src/audio/sfx'
import { PAD_HZ } from '../../src/audio/finale'
import { MOTIF, dbToGain, motifBusyUntil, motifWarning, playMotif, type MotifOpts } from '../../src/audio/motif'
import { nextWarningDelay, warningAllowed, WARNING_RANGE } from '../../src/audio/paranoiaAudio'

interface Osc {
  type: string
  hz: number
  starts: number[]
  stops: number[]
  isLfo: boolean
}
const run = (o?: MotifOpts) => {
  const oscs: Osc[] = []
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} })
  const node = () => ({ connect: (n: unknown) => n, disconnect() {}, gain: param(), frequency: param(), detune: param(), Q: param(), type: '' })
  const c = {
    currentTime: 1,
    createGain: node,
    createBiquadFilter: node,
    createOscillator: () => {
      const n = { ...node(), starts: [] as number[], stops: [] as number[], start: (t: number) => n.starts.push(t), stop: (t: number) => n.stops.push(t) }
      const rec = {
        get type() {
          return n.type
        },
        get hz() {
          return n.frequency.value
        },
        starts: n.starts,
        stops: n.stops,
        get isLfo() {
          return n.frequency.value === 5.2
        },
      }
      oscs.push(rec as unknown as Osc)
      return n
    },
  }
  const dur = playMotif(c as unknown as AudioContext, c as unknown as AudioNode, o)
  return { oscs, dur }
}
/** Fréquences des notes (sinus principal sans écho : on garde le premier exemplaire de chaque note). */
const noteHz = (oscs: Osc[]) => oscs.filter((x) => x.type === 'sine' && !x.isLfo).map((x) => x.hz)

describe('motif', () => {
  beforeEach(() => {
    muted.value = false
    motifBusyUntil.value = 0
  })

  it('mystère et aube : Hz et ms', () => {
    expect(MOTIF.mystere.hz).toEqual([329.63, 440, 466.16])
    expect(MOTIF.mystere.ms).toEqual([170, 170, 600])
    expect(MOTIF.aube.hz).toEqual([329.63, 440, 554.37])
    expect(MOTIF.aube.ms).toEqual([170, 170, 900])
  })

  it('mystère : quarte juste (4/3) puis demi-ton (16/15) ; aube finit sur la sixte majeure (5/3)', () => {
    const [e, a, b] = MOTIF.mystere.hz
    expect(a / e).toBeCloseTo(4 / 3, 2)
    expect(b / a).toBeCloseTo(16 / 15, 1) // demi-ton tempéré (1,0595) ≈ 16/15
    expect(MOTIF.aube.hz[2] / MOTIF.aube.hz[0]).toBeCloseTo(5 / 3, 1)
  })

  it('dbToGain : -20 dB avec marge 1 = 0,1 ; marge par défaut 1,6', () => {
    expect(dbToGain(-20, 1)).toBeCloseTo(0.1, 6)
    expect(dbToGain(-20)).toBeCloseTo(0.1 / 1.6, 6)
    expect(dbToGain(0, 1)).toBe(1)
  })

  it('muet : aucun oscillateur, durée 0, état occupé inchangé', () => {
    muted.value = true
    const { oscs, dur } = run()
    expect(oscs).toHaveLength(0)
    expect(dur).toBe(0)
    expect(motifBusyUntil.value).toBe(0)
  })

  it('chaque oscillateur démarré a un arrêt planifié (après son départ)', () => {
    for (const o of [{}, { variant: 'aube' as const, pure: true, octave: 1 }, { slow: 2.4, echo: false }, motifWarning()]) {
      const { oscs } = run(o)
      expect(oscs.length).toBeGreaterThan(0)
      for (const x of oscs) {
        expect(x.starts).toHaveLength(1)
        expect(x.stops).toHaveLength(1)
        expect(x.stops[0]).toBeGreaterThan(x.starts[0])
      }
    }
  })

  it('notes jouées dans l’ordre, 3 notes × 3 copies (écho) ; sans écho 3 copies en moins', () => {
    expect(noteHz(run().oscs)).toHaveLength(9)
    expect(noteHz(run({ echo: false }).oscs)).toEqual(MOTIF.mystere.hz)
  })

  it('octave : +1 double les hauteurs, -1 les divise ; sinus pur : pas de triangle', () => {
    expect(noteHz(run({ octave: 1, echo: false }).oscs)).toEqual(MOTIF.mystere.hz.map((f) => f * 2))
    expect(noteHz(run({ octave: -1, echo: false }).oscs)).toEqual(MOTIF.mystere.hz.map((f) => f / 2))
    expect(run({ pure: true }).oscs.some((x) => x.type === 'triangle')).toBe(false)
    expect(run().oscs.some((x) => x.type === 'triangle')).toBe(true)
  })

  it('slow allonge la durée (et l’écho avec) ; durée plausible du motif de base', () => {
    const base = run().dur
    const slow = run({ slow: 2.4 }).dur
    expect(slow).toBeGreaterThan(base * 2)
    expect(run({ slow: 0.6, echo: false }).dur).toBeLessThan(base)
    expect(base).toBeGreaterThan(0.94)
    expect(base).toBeLessThan(2.2)
  })

  it('motifBusyUntil : horloge du contexte, fin du motif', () => {
    const { dur } = run({ at: 5 })
    expect(motifBusyUntil.value).toBeCloseTo(5 + dur, 6)
  })

  it('l’avertissement est grave, lent et voilé', () => {
    const w = motifWarning()
    expect(w.octave).toBe(-1)
    expect(w.slow).toBeCloseTo(2.4)
    expect(w.lowpass).toBe(900)
    expect(w.peakDb).toBe(-26)
  })
})

describe('tonalité commune en la', () => {
  const pitchClass = (hz: number) => Math.round(12 * Math.log2(hz / 440) + 1200) % 12 // 0 = la
  const LA_MAJEUR = new Set([0, 2, 4, 6, 7, 9, 11])

  it('l’hymne est un arpège de la majeur qui finit sur la / mi', () => {
    expect(HYMN_HZ).toEqual([220, 277.18, 329.63, 440, 329.63])
    for (const f of HYMN_HZ) expect(LA_MAJEUR.has(pitchClass(f))).toBe(true)
  })
  it('la nappe de l’aube finale est en la majeur', () => {
    expect(PAD_HZ).toEqual([110, 138.59, 164.81, 220, 277.18])
    for (const f of PAD_HZ) expect(LA_MAJEUR.has(pitchClass(f))).toBe(true)
  })
  it('le blip du retournement de carte est un do♯', () => {
    expect(FLIP_BLIP_HZ).toBe(554.37)
    expect(pitchClass(FLIP_BLIP_HZ)).toBe(4)
  })
})

describe('avertissement rare', () => {
  it('jamais aux niveaux 1–2, permis dès le 3', () => {
    for (const l of [1, 2]) {
      expect(warningAllowed(l)).toBe(false)
      expect(nextWarningDelay(l, () => 0.5)).toBeNull()
    }
    for (const l of [3, 4, 5]) expect(warningAllowed(l)).toBe(true)
  })
  it('délai entre 60 et 90 s', () => {
    expect(nextWarningDelay(3, () => 0)).toBe(WARNING_RANGE.min)
    expect(nextWarningDelay(5, () => 0.999999)).toBeCloseTo(WARNING_RANGE.max, 3)
    expect(WARNING_RANGE).toEqual({ min: 60, max: 90 })
  })
})
