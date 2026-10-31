import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { phraseGain, type NoteEvent } from '@/audio/musicPlan'
import { MAX_RINGING, NOTE_TRIM, notePartials, partialAmp, partialHz, peakSources, playPhrase, sourceSpans, stealCuts } from '@/audio/pianoVoice'
import { FakeCtx, param, type FakeNode } from './fakeAudio'

const note = (over: Partial<NoteEvent> = {}): NoteEvent => ({ at: 0, midi: 69, hz: 440, velocity: 0.6, decay: 6, release: 100, cents: 0, sag: 0, voice: 'melody', chord: 0, ...over })

let c: FakeCtx
let out: FakeNode
const play = (notes: NoteEvent[], t0 = 1, wobble = 0) => playPhrase(c as unknown as BaseAudioContext, out as unknown as AudioNode, t0, notes, wobble)
const oscs = () => c.all('oscillator')

beforeEach(() => {
  c = new FakeCtx()
  out = c.createGain()
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('timbre pur', () => {
  it('amplitude : le fondamental domine, décroissance monotone, les aigus s’effacent à faible vélocité', () => {
    expect(partialAmp(1, 0.5)).toBe(1)
    for (let n = 2; n <= 8; n++) expect(partialAmp(n, 0.8)).toBeLessThan(partialAmp(n - 1, 0.8))
    expect(partialAmp(6, 0.3)).toBeLessThan(partialAmp(6, 1))
  })
  it('inharmonicité : les partiels sont étirés vers l’aigu, davantage dans le grave', () => {
    expect(partialHz(440, 1)).toBeCloseTo(440, 1)
    expect(partialHz(440, 4)).toBeGreaterThan(4 * 440)
    const stretch = (hz: number) => partialHz(hz, 6) / (6 * hz)
    expect(stretch(65)).toBeGreaterThan(stretch(800))
  })
  it('mélodie : 8 partiels au plus, l’accompagnement 5 ; aucun partiel au-dessus de 6 kHz ; deux cordes pour les deux premiers seulement', () => {
    const mel = notePartials(note({ hz: 220 }), 6)
    const acc = notePartials(note({ hz: 220, voice: 'inner' }), 6)
    expect(mel).toHaveLength(8)
    expect(acc).toHaveLength(5)
    expect(mel.map((p) => p.strings)).toEqual([2, 2, 1, 1, 1, 1, 1, 1])
    const aigu = notePartials(note({ hz: 1760 }), 6)
    expect(aigu.length).toBeLessThan(8)
    expect(aigu.every((p) => p.hz <= 6000)).toBe(true)
  })
  it('l’étouffoir borne la fin de chaque partiel', () => {
    for (const p of notePartials(note(), 0.5)) expect(p.stop).toBeLessThanOrEqual(0.5)
  })
  it('stealCuts : aucune coupure sous le plafond ; au-delà, la plus ancienne est coupée à l’attaque de la nouvelle', () => {
    const peu = Array.from({ length: MAX_RINGING - 1 }, (_, i) => note({ at: i * 0.1, decay: 20 }))
    expect(stealCuts(peu).every((x) => x === Infinity)).toBe(true)
    const trop = Array.from({ length: MAX_RINGING + 1 }, (_, i) => note({ at: i, decay: 20, midi: 57 }))
    const cuts = stealCuts(trop)
    expect(cuts[0]).toBe(MAX_RINGING)
    expect(cuts[MAX_RINGING]).toBe(Infinity)
  })
  it('peakSources compte le flottement : une note seule a au moins 1 + partiels·cordes + marteau sources', () => {
    const n = note({ decay: 1 })
    const attendu = notePartials(n, Infinity).reduce((s, p) => s + p.strings, 0)
    expect(peakSources([n])).toBeGreaterThanOrEqual(attendu)
    expect(sourceSpans([n]).at(-1)![0]).toBe(0)
  })
})

describe('playPhrase', () => {
  it('une note de mélodie : une corde par partiel/corde, démarrées à t0 + at, arrêtées à la fin audible + 50 ms', () => {
    const n = note({ at: 0.5 })
    const parts = notePartials(n, Infinity)
    play([n], 2)
    const notes = oscs().filter((o) => o.starts[0][0] === 2.5)
    expect(notes).toHaveLength(parts.reduce((s, p) => s + p.strings, 0))
    const maxStop = Math.max(...parts.map((p) => p.stop))
    expect(Math.max(...notes.map((o) => o.stops[0][0]))).toBeCloseTo(2.5 + maxStop + 0.05)
    // fréquences : celles des partiels
    const hzs = new Set(notes.map((o) => param(o, 'frequency').value))
    for (const p of parts) expect(hzs.has(p.hz)).toBe(true)
  })

  it('cordes doubles désaccordées de ±1–3 cents autour du désaccord de la note ; cordes simples exactes', () => {
    play([note({ cents: 7 })])
    const details = oscs()
      .slice(1)
      .map((o) => param(o, 'detune').of('setValueAtTime')[0][0])
    // aléa figé à 0,5 : écart ±2 cents pour les deux premiers partiels (4 cordes)
    expect(details.slice(0, 4)).toEqual([5, 9, 5, 9])
    expect(details.slice(4).every((d) => d === 7)).toBe(true)
  })

  it('affaissement (niveau 5) : la hauteur glisse de `sag` cents sur la résonance naturelle', () => {
    play([note({ cents: 0, sag: -30, decay: 4 })])
    const o = oscs()[5] // partiel 3, corde simple (flottement, 2 + 2 cordes avant)
    expect(param(o, 'detune').of('linearRampToValueAtTime')).toEqual([[-30, 1 + 4 / 3 ** 0.65]])
    const sansSag = c.all('oscillator').length
    play([note({ sag: 0 })])
    expect(param(oscs()[sansSag + 5], 'detune').of('linearRampToValueAtTime')).toEqual([])
  })

  it('l’enveloppe d’un partiel : attaque douce de 8 ms puis deux décroissances (coup, résonance)', () => {
    const n = note({ at: 0 })
    const [p1] = notePartials(n, Infinity)
    play([n], 1)
    const env = oscs()[1].connections[0]
    expect(param(env, 'gain').of('setValueAtTime')[0]).toEqual([0.0001, 1])
    expect(param(env, 'gain').of('linearRampToValueAtTime')[0][0]).toBeCloseTo(p1.amp)
    expect(param(env, 'gain').of('linearRampToValueAtTime')[0][1]).toBeCloseTo(1.008)
    const expo = param(env, 'gain').of('exponentialRampToValueAtTime')
    expect(expo[0][1]).toBeCloseTo(1 + p1.prompt)
    expect(expo[1]).toEqual([0.0001, 1 + p1.natural])
  })

  it('étouffoir : à la chute des pédales la note s’éteint exponentiellement ; sans chute, elle court jusqu’à sa résonance', () => {
    play([note({ at: 0, decay: 6, release: 1 })], 0)
    const gains = c.all('gain')
    const noteGain = gains.find((g) =>
      param(g, 'gain')
        .of('exponentialRampToValueAtTime')
        .some((a) => Math.abs(a[0] - 0.6 * NOTE_TRIM * 0.002) < 1e-12),
    )!
    expect(noteGain).toBeDefined()
    // 6 constantes de temps de 50 ms (note aiguë) après la chute
    expect(param(noteGain, 'gain').of('exponentialRampToValueAtTime')[0][1]).toBeCloseTo(1 + 6 * 0.05)
    expect(param(noteGain, 'gain').of('setValueAtTime')).toEqual([
      [0.6 * NOTE_TRIM, 0],
      [0.6 * NOTE_TRIM, 1],
    ])

    c = new FakeCtx()
    out = c.createGain()
    play([note({ at: 0, decay: 6, release: 100 })], 0)
    const libres = c.all('gain').filter((g) =>
      param(g, 'gain')
        .of('setValueAtTime')
        .some((a) => a[0] === 0.6 * NOTE_TRIM),
    )
    expect(libres).toHaveLength(1)
    expect(param(libres[0], 'gain').of('exponentialRampToValueAtTime')).toEqual([])
  })

  it('timbre : passe-bas de la note plus ouvert à forte vélocité ; marteau de feutre borné à 700 Hz', () => {
    play([note({ velocity: 0.2 }), note({ velocity: 1, at: 1 })])
    const lps = c.all('biquad')
    const note1 = lps[0]
    const marteau1 = lps[1]
    const note2 = lps[2]
    expect(param(note1, 'frequency').value).toBeCloseTo(650 + 0.2 * 1700)
    expect(param(note2, 'frequency').value).toBeCloseTo(650 + 1700)
    expect(param(marteau1, 'frequency').value).toBe(700)
    play([note({ hz: 110 })])
    expect(param(c.all('biquad').at(-1)!, 'frequency').value).toBe(220)
  })

  it('un marteau par note, démarré à l’attaque et arrêté 60 ms plus tard', () => {
    play([note({ at: 0 }), note({ at: 2 })], 1)
    const src = c.all('bufferSource')
    expect(src).toHaveLength(2)
    expect(src.map((s) => s.stops[0][0])).toEqual([1.06, 3.06])
    expect(src.map((s) => s.starts[0][0])).toEqual([1, 3])
  })

  it('bus : gain 1 vers la sortie, réserve de dynamique de phraseGain, limiteur tanh, salle à 16 %', () => {
    const notes = [note(), note({ at: 0.2, midi: 72, hz: 523.25 })]
    play(notes)
    const [bus, sum, ceil, wet] = [c.all('gain')[1], c.all('gain')[2], c.all('gain')[3], c.all('gain')[4]]
    expect(bus.connections).toEqual([out])
    expect(param(bus, 'gain').value).toBe(1)
    expect(param(sum, 'gain').value).toBeCloseTo(phraseGain(notes) / (0.14 * 4))
    expect(param(ceil, 'gain').value).toBe(0.14)
    expect(param(wet, 'gain').value).toBe(0.16)
    const shaper = c.all('shaper')[0]
    const curve = shaper.curve as Float32Array
    expect(curve).toHaveLength(2048)
    expect(curve[0]).toBeCloseTo(-Math.tanh(4))
    expect(curve[2047]).toBeCloseTo(Math.tanh(4))
    expect(Math.abs(curve[1023] + curve[1024])).toBeLessThan(1e-3)
    const conv = c.all('convolver')[0]
    expect((conv.buffer as { duration: number }).duration).toBe(2)
  })

  it('la salle est générée une fois par contexte et partagée entre phrases', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9) // bruit non nul
    play([note()])
    play([note()])
    expect(c.all('convolver')[0].buffer).toBe(c.all('convolver')[1].buffer)
    const d = (c.all('convolver')[0].buffer as { getChannelData: (i: number) => Float32Array }).getChannelData(0)
    expect(d[0]).toBe(0)
    expect(Math.max(...d.map(Math.abs))).toBeGreaterThan(0)
  })

  it('flottement : ±2 cents par défaut, renforcé par `wobble` aux niveaux 3–4, partagé par toutes les cordes', () => {
    play([note()], 1, 0)
    const lfo = oscs()[0]
    expect(param(lfo, 'frequency').value).toBeCloseTo(0.4)
    const lfoGain = lfo.connections[0]
    expect(param(lfoGain, 'gain').value).toBe(2)
    expect(
      oscs()
        .slice(1)
        .every((o) => lfoGain.connections.includes(param(o, 'detune') as unknown as FakeNode)),
    ).toBe(true)
    play([note()], 1, 6)
    expect(param(c.all('oscillator').find((o, i) => i > 0 && o.kind === 'oscillator' && param(o, 'frequency').value < 1)!.connections[0], 'gain').value).toBe(6)
  })

  it('end : fin du dernier partiel + 1 s de queue de salle ; le flottement s’arrête avec la phrase', () => {
    const n = note({ at: 0 })
    const fin = 1 + Math.max(...notePartials(n, Infinity).map((p) => p.stop)) + 0.05
    const h = play([n], 1)
    expect(h.end).toBeCloseTo(fin + 1)
    expect(oscs()[0].starts).toEqual([[1]])
    expect(oscs()[0].stops).toEqual([[fin]])
  })

  it('stop(fade) : fondu du bus (cible 0, constante fade/4) et arrêt de toutes les sources à now + fade + 50 ms ; idempotent', () => {
    const h = play([note(), note({ at: 1 })])
    c.currentTime = 1.5
    h.stop(0.8)
    const bus = c.all('gain')[1]
    expect(param(bus, 'gain').of('cancelScheduledValues')).toEqual([[1.5]])
    expect(param(bus, 'gain').of('setTargetAtTime')).toEqual([[0, 1.5, 0.2]])
    const sources = [...oscs(), ...c.all('bufferSource')]
    for (const s of sources) expect(s.stops.at(-1)).toEqual([1.5 + 0.8 + 0.05])
    const nbArrets = sources.reduce((s, x) => s + x.stops.length, 0)
    h.stop(0.8)
    expect(sources.reduce((s, x) => s + x.stops.length, 0)).toBe(nbArrets)
  })

  it('stop() sans argument : fondu par défaut de 0,4 s ; une source déjà arrêtée n’empêche pas les autres', () => {
    const h = play([note()])
    oscs()[1].stopThrows = true
    c.currentTime = 2
    expect(() => h.stop()).not.toThrow()
    expect(param(c.all('gain')[1], 'gain').of('setTargetAtTime')).toEqual([[0, 2, 0.1]])
    expect(oscs()[2].stops.at(-1)![0]).toBeCloseTo(2.45)
  })

  it('nettoyage : quand toutes les sources ont fini, les nœuds sont débranchés après la queue de salle (2,5 s)', () => {
    play([note({ decay: 1 })])
    const sources = [...oscs(), ...c.all('bufferSource')]
    const nodes = [c.all('gain')[1], c.all('gain')[2], c.all('shaper')[0], c.all('gain')[3], c.all('convolver')[0], c.all('gain')[4]]
    sources.slice(0, -1).forEach((s) => s.onended?.())
    vi.advanceTimersByTime(10_000)
    expect(nodes.every((n) => n.disconnected === 0)).toBe(true) // une source encore vivante
    sources.at(-1)!.onended?.()
    vi.advanceTimersByTime(2499)
    expect(nodes.every((n) => n.disconnected === 0)).toBe(true)
    vi.advanceTimersByTime(2)
    expect(nodes.every((n) => n.disconnected === 1)).toBe(true)
  })
})
