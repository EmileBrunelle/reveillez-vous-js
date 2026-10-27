import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../src/engine/rng'
import { PIANO_PHRASES } from '../../src/content/pianoPhrases'
import {
  GAP_MAX,
  GAP_MIN,
  KEYS,
  RESUME_MAX,
  RESUME_MIN,
  canStartPhrase,
  choosePhrase,
  chordStarts,
  createSession,
  inScale,
  musicGap,
  noteToMidi,
  perform,
  phraseDuration,
  phraseGain,
  planPhrase,
  realize,
  releaseBusy,
  resumeDelay,
  type NoteEvent,
  type PhraseGate,
} from '../../src/audio/musicPlan'

const A_MAJOR = new Set([9, 11, 1, 2, 4, 6, 8])
const pc = (m: number) => ((m % 12) + 12) % 12
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const melody = (p: NoteEvent[]) => p.filter((n) => n.voice === 'melody')
const accomp = (p: NoteEvent[]) => p.filter((n) => n.voice !== 'melody')

describe('phrases composées', () => {
  it('4 à 6 phrases de 8 à 16 s à leur tempo', () => {
    expect(PIANO_PHRASES.length).toBeGreaterThanOrEqual(4)
    expect(PIANO_PHRASES.length).toBeLessThanOrEqual(6)
    for (const p of PIANO_PHRASES) {
      const s = (chordStarts(p).total * 60) / p.bpm
      expect(s).toBeGreaterThanOrEqual(8)
      expect(s).toBeLessThanOrEqual(16)
      expect(p.bpm).toBeGreaterThanOrEqual(60)
      expect(p.bpm).toBeLessThanOrEqual(72)
    }
  })
  it('toutes les notes sont en la majeur (et en fa♯ mineur relatif), hors notes chromatiques documentées', () => {
    for (const p of PIANO_PHRASES) for (const key of [KEYS.A, KEYS['F#m']]) for (const n of realize(p, key)) if (!n.chromatic) expect(A_MAJOR.has(pc(n.midi)), `${p.name} ${n.midi}`).toBe(true)
  })
  it('mélodie chantable : sauts d’une quinte au plus, au-dessus de la main gauche', () => {
    for (const p of PIANO_PHRASES) {
      const m = p.melody.map(([, n]) => noteToMidi(n))
      for (let i = 1; i < m.length; i++) expect(Math.abs(m[i] - m[i - 1]), p.name).toBeLessThanOrEqual(7)
      const lhTop = Math.max(...p.chords.flatMap((c) => c.lh.map(([, n]) => noteToMidi(n))))
      expect(Math.min(...m), p.name).toBeGreaterThan(lhTop)
    }
  })
  it('pas de quintes ni d’octaves parallèles entre la basse et la mélodie d’un accord à l’autre', () => {
    for (const p of PIANO_PHRASES) {
      const { starts } = chordStarts(p)
      // basse et note de mélodie qui sonnent à l’attaque de chaque accord
      const outer = p.chords.map((c, k) => {
        const bass = noteToMidi(c.lh[0][1])
        const top = p.melody.filter(([b]) => b <= starts[k] + 1e-9).at(-1)
        return { bass, top: noteToMidi(top![1]) }
      })
      for (let k = 1; k < outer.length; k++) {
        const a = outer[k - 1]
        const b = outer[k]
        const perfect = (x: { bass: number; top: number }) => [0, 7].includes(pc(x.top - x.bass))
        const moved = a.bass !== b.bass && a.top !== b.top
        const same = Math.sign(b.bass - a.bass) === Math.sign(b.top - a.top)
        const parallel = perfect(a) && perfect(b) && pc(a.top - a.bass) === pc(b.top - b.bass) && moved && same
        expect(parallel, `${p.name} accord ${k}`).toBe(false)
      }
    }
  })
  it('la mineur : relecture par degrés (I → i, vi7 → VImaj7), pas de do♯ ni de fa♯', () => {
    const notes = PIANO_PHRASES.flatMap((p) => realize(p, KEYS.Am))
    expect(notes.some((n) => pc(n.midi) === 0)).toBe(true) // do naturel
    expect(notes.some((n) => pc(n.midi) === 5)).toBe(true) // fa naturel
    expect(notes.every((n) => pc(n.midi) !== 1 && pc(n.midi) !== 6 && pc(n.midi) !== 8)).toBe(true)
  })
})

describe('planPhrase', () => {
  it('est déterministe pour un même Rng', () => {
    for (const l of [1, 3, 5]) expect(planPhrase(l, mulberry32(42))).toEqual(planPhrase(l, mulberry32(42)))
  })
  it('reste bornée', () => {
    for (let l = 1; l <= 5; l++)
      for (let s = 1; s <= 40; s++) {
        const p = planPhrase(l, mulberry32(s))
        for (const n of p) {
          expect(n.midi).toBeGreaterThanOrEqual(30)
          expect(n.midi).toBeLessThanOrEqual(84)
          expect(n.velocity).toBeGreaterThan(0)
          expect(n.velocity).toBeLessThanOrEqual(1)
          expect(n.at).toBeGreaterThanOrEqual(0)
          expect(n.release).toBeGreaterThan(n.at)
        }
        expect(phraseDuration(p)).toBeLessThan(30)
        expect(phraseGain(p)).toBeGreaterThan(0.2)
        expect(phraseGain(p)).toBeLessThanOrEqual(1)
      }
  })
  it('niveaux 1–2 : toutes les notes dans la gamme, justes', () => {
    for (const l of [1, 2])
      for (let s = 1; s <= 40; s++) {
        const p = planPhrase(l, mulberry32(s))
        expect(p.every((n) => A_MAJOR.has(pc(n.midi)) && n.cents === 0 && n.sag === 0)).toBe(true)
      }
  })
  it('jamais la même phrase deux fois de suite ; toutes reviennent', () => {
    for (let s = 1; s <= 20; s++) {
      const r = mulberry32(s)
      const session = createSession()
      const seen: number[] = []
      for (let i = 0; i < 40; i++) {
        planPhrase(1, r, session)
        seen.push(session.last!)
      }
      for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1])
      expect(new Set(seen).size).toBe(PIANO_PHRASES.length)
    }
  })
  it('le sac ne répète pas d’un remplissage à l’autre', () => {
    const r = mulberry32(5)
    const session = createSession()
    let prev = -1
    for (let i = 0; i < 200; i++) {
      const k = choosePhrase(session, r)
      expect(k).not.toBe(prev)
      prev = k
    }
  })
  it('fa♯ mineur de temps en temps aux niveaux 1–2, la mineur aux niveaux 3–5', () => {
    const r = mulberry32(11)
    const session = createSession()
    const keys = Array.from({ length: 200 }, () => (planPhrase(1, r, session), session.lastKey))
    const share = keys.filter((k) => k === 'F#m').length / keys.length
    expect(share).toBeGreaterThan(0.08)
    expect(share).toBeLessThan(0.35)
    for (const l of [3, 4, 5]) {
      planPhrase(l, r, session)
      expect(session.lastKey).toBe('Am')
    }
  })
  it('la mélodie est ≈ 20 % plus forte que l’accompagnement', () => {
    for (let s = 1; s <= 40; s++)
      for (const l of [1, 3]) {
        const p = planPhrase(l, mulberry32(s))
        expect(mean(melody(p).map((n) => n.velocity)) / mean(accomp(p).map((n) => n.velocity))).toBeGreaterThan(1.15)
      }
  })
  it('pédale : chaque accord s’éteint ensemble au changement suivant, le dernier résonne', () => {
    for (let s = 1; s <= 30; s++)
      PIANO_PHRASES.forEach((phrase, i) => {
        const p = perform(phrase, KEYS.A, 1, mulberry32(s * 10 + i))
        const last = phrase.chords.length - 1
        for (let k = 0; k < last; k++) {
          const next = Math.min(...p.filter((n) => n.chord === k + 1).map((n) => n.at))
          // notes attaquées et relâchées dans l’accord k : étouffées juste au moment où sonne l’accord suivant
          const held = p.filter((n) => n.chord === k && n.release < next + 0.2)
          expect(held.length).toBeGreaterThan(0)
          for (const n of held) expect(Math.abs(n.release - next)).toBeLessThan(0.1)
          // une note ne s’éteint jamais avant le changement de pédale
          for (const n of p.filter((x) => x.chord === k)) expect(n.release).toBeGreaterThan(next - 0.1)
        }
        const end = Math.max(...p.map((n) => n.at))
        for (const n of p.filter((x) => x.chord === last)) expect(n.release).toBeGreaterThan(end + 2)
      })
  })
  it('interprétation : accords roulés de la basse vers l’aigu en 10–40 ms, attaques non quantifiées', () => {
    for (let s = 1; s <= 20; s++) {
      const phrase = PIANO_PHRASES[1]
      const p = perform(phrase, KEYS.A, 1, mulberry32(s))
      const first = p.filter((n) => n.chord === 0 && n.at < 0.2).sort((a, b) => a.at - b.at)
      expect(first.length).toBeGreaterThanOrEqual(3)
      for (let i = 1; i < first.length; i++) expect(first[i].midi).toBeGreaterThan(first[i - 1].midi)
      const spread = first.at(-1)!.at - first[0].at
      expect(spread).toBeGreaterThanOrEqual(0.009)
      expect(spread).toBeLessThanOrEqual(0.041)
    }
    const a = perform(PIANO_PHRASES[0], KEYS.A, 1, mulberry32(1)).map((n) => n.at)
    const b = perform(PIANO_PHRASES[0], KEYS.A, 1, mulberry32(2)).map((n) => n.at)
    expect(a).not.toEqual(b)
  })
  it('niveaux 3–4 : la mineur, chaque note désaccordée de 10 à 20 cents', () => {
    for (const l of [3, 4])
      for (let s = 1; s <= 30; s++) {
        const p = planPhrase(l, mulberry32(s))
        expect(p.every((n) => Math.abs(n.cents) >= 10 && Math.abs(n.cents) <= 20 && n.sag === 0)).toBe(true)
        expect(p.every((n) => inScale(n.midi, KEYS.Am))).toBe(true)
      }
  })
  it('le niveau 5 diffère du niveau 1', () => {
    for (let s = 1; s <= 10; s++) expect(planPhrase(5, mulberry32(s))).not.toEqual(planPhrase(1, mulberry32(s)))
  })
  it('niveau 5 : pédale jamais relevée, notes tombées, une ou deux fausses notes, hauteur qui s’affaisse', () => {
    let dropped = 0
    for (let s = 1; s <= 40; s++)
      PIANO_PHRASES.forEach((phrase, i) => {
        const l3 = perform(phrase, KEYS.Am, 3, mulberry32(s * 7 + i))
        const l5 = perform(phrase, KEYS.Am, 5, mulberry32(s * 7 + i))
        dropped += l3.length - l5.length
        expect(l5.every((n) => n.release >= n.at + n.decay - 1e-9)).toBe(true)
        const wrong = l5.filter((n) => !inScale(n.midi, KEYS.Am))
        expect(wrong.length).toBeGreaterThanOrEqual(1)
        expect(wrong.length).toBeLessThanOrEqual(2)
        expect(wrong.every((n) => n.voice === 'melody')).toBe(true)
        expect(l5.every((n) => n.sag < 0)).toBe(true)
        // l’affaissement grandit au fil de la phrase
        const early = mean(l5.slice(0, 6).map((n) => n.cents))
        const late = mean(l5.slice(-6).map((n) => n.cents))
        expect(late).toBeLessThan(early)
        // la dernière note de mélodie reste juste (ancrage : hanté, pas comique)
        expect(inScale(melody(l5).at(-1)!.midi, KEYS.Am)).toBe(true)
      })
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
