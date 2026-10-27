import type { Rng } from '../engine/rng'
import { PIANO_PHRASES, type ComposedPhrase } from '../content/pianoPhrases'

// Piano clairsemé (esprit C418) : on joue des phrases composées (src/content/pianoPhrases.ts), interprétées par un Rng injecté
// (rubato, accords roulés, nuances), pures et déterministes pour un Rng donné. La synthèse est dans pianoVoice.ts.

export type Voice = 'melody' | 'bass' | 'inner'

export interface NoteEvent {
  /** Départ (s) depuis le début de la phrase. */
  at: number
  midi: number
  hz: number
  /** 0–1. */
  velocity: number
  /** Résonance naturelle (s) de la corde : le grave dure plus longtemps. */
  decay: number
  /** Chute des étouffoirs (s depuis le début de la phrase) : changement de pédale ; la note s’éteint en ≈ DAMPER_TAIL. */
  release: number
  /** Désaccord fixe (cents) : niveaux 3–4 (flottant), 5 (affaissement progressif). */
  cents: number
  /** Chute de hauteur (cents) sur la durée de la note : niveau 5 seulement. */
  sag: number
  voice: Voice
  /** Indice de l’accord (région de pédale) dans la phrase composée. */
  chord: number
}

export const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const
export const MINOR = [0, 2, 3, 5, 7, 8, 10] as const
/** Référence d’écriture : les phrases sont notées en la majeur, degrés comptés depuis la 3 (MIDI 57). */
const WRITTEN_TONIC = 57

export type KeyName = 'A' | 'F#m' | 'Am'
export interface Key {
  name: KeyName
  tonic: number
  scale: readonly number[]
}
/** La majeur ; fa♯ mineur (relatif, mêmes notes, une tierce mineure plus bas) ; la mineur (niveaux 3–5). */
export const KEYS: Record<KeyName, Key> = {
  A: { name: 'A', tonic: 57, scale: MAJOR },
  'F#m': { name: 'F#m', tonic: 54, scale: MINOR },
  Am: { name: 'Am', tonic: 57, scale: MINOR },
}

/** Part des phrases jouées en fa♯ mineur aux niveaux 1–2. */
export const RELATIVE_MINOR_CHANCE = 0.2
/** Main droite ≈ 20 % au-dessus de l’accompagnement ; la basse un peu au-dessus des notes intérieures. */
export const VOICE_GAIN: Record<Voice, number> = { melody: 1.2, bass: 1, inner: 0.82 }
const VELOCITY_SPREAD = 0.08
/** Jitter d’attaque (s) : faible au début, plus large en fin de phrase. */
const JITTER_BASE = 0.01
const JITTER_END = 0.03
/** Accord roulé : de la basse vers l’aigu, 10–40 ms au total. */
const ROLL_MIN = 0.01
const ROLL_MAX = 0.04
/** Respiration (s) ajoutée au plus à chaque changement d’accord. */
const BREATH_MAX = 0.05
/** Ritardando sur les 3 derniers temps : allongement final du temps (fraction). */
const RIT_BEATS = 3
/** Pédale finale : le dernier accord sonne encore ≈ 3,5 s après la fin écrite. */
const FINAL_RING = 3.5
/** Temps (s) pour qu’un étouffoir éteigne la corde (la voix l’honore, un peu plus lentement dans le grave). */
export const DAMPER_TAIL = 0.4
/** Niveau 5 : notes intérieures et mélodiques qui tombent, dérive de hauteur sur la phrase (cents). */
const L5_DROP_INNER = 0.25
const L5_DROP_MELODY = 0.12
const L5_DRIFT = 30

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/** Bornes de la pause entre deux phrases (s). */
export const GAP_MIN = 40
export const GAP_MAX = 90
export const musicGap = (rng: Rng): number => GAP_MIN + rng() * (GAP_MAX - GAP_MIN)

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
/** « C#4 » → 61. */
export const noteToMidi = (name: string): number => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)
  if (!m) throw new Error(`Note inconnue : ${name}`)
  return 12 * (Number(m[3]) + 1) + LETTERS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}

/** Relit une hauteur écrite en la majeur dans `key` : même degré, même octave relative (une note chromatique garde son altération). */
export const inKey = (midi: number, key: Key): number => {
  const rel = midi - WRITTEN_TONIC
  const oct = Math.floor(rel / 12)
  const pc = rel - 12 * oct
  let idx = MAJOR.indexOf(pc as (typeof MAJOR)[number])
  let alt = 0
  if (idx < 0) {
    idx = MAJOR.indexOf((pc - 1) as (typeof MAJOR)[number])
    alt = 1
  }
  return key.tonic + 12 * oct + key.scale[idx] + alt
}

/** Classe de hauteur dans la gamme de `key` ? */
export const inScale = (midi: number, key: Key): boolean => key.scale.includes(((((midi - key.tonic) % 12) + 12) % 12) as never)

/** Note écrite, avant interprétation : temps, hauteur dans la tonalité, voix, accord, fin de la région de pédale (temps). */
export interface WrittenNote {
  beat: number
  midi: number
  voice: Voice
  chord: number
  /** Temps où l’étouffoir retombe : changement d’accord suivant (ou plus tard si la touche est tenue au-delà). */
  pedalUp: number
  /** La note appartient au dernier accord (pédale finale). */
  final: boolean
  chromatic: boolean
}

/** Débuts des accords (temps) et longueur totale. */
export const chordStarts = (p: ComposedPhrase): { starts: number[]; total: number } => {
  const starts: number[] = []
  let b = 0
  for (const c of p.chords) {
    starts.push(b)
    b += c.beats
  }
  return { starts, total: b }
}

/** Phrase écrite dans une tonalité : pédale changée à chaque accord ; une touche tenue au-delà est reprise par la pédale suivante. */
export const realize = (p: ComposedPhrase, key: Key): WrittenNote[] => {
  const { starts, total } = chordStarts(p)
  const chordAt = (b: number) => {
    let k = 0
    while (k + 1 < starts.length && starts[k + 1] <= b + 1e-9) k++
    return k
  }
  const endOf = (k: number) => (k + 1 < starts.length ? starts[k + 1] : total)
  const out: WrittenNote[] = []
  p.chords.forEach((c, k) => {
    c.lh.forEach(([b, n], i) => {
      out.push({ beat: starts[k] + b, midi: inKey(noteToMidi(n), key), voice: i === 0 ? 'bass' : 'inner', chord: k, pedalUp: endOf(k), final: k === starts.length - 1, chromatic: false })
    })
  })
  for (const [b, n, len, chromatic] of p.melody) {
    const k = chordAt(b)
    const held = chordAt(b + len - 1e-6)
    out.push({ beat: b, midi: inKey(noteToMidi(n), key), voice: 'melody', chord: k, pedalUp: endOf(held), final: held === starts.length - 1, chromatic: chromatic === true })
  }
  return out.sort((x, y) => x.beat - y.beat || x.midi - y.midi)
}

/** Résonance naturelle (s) selon la hauteur : ≈ 10 s dans le grave, ≈ 3,5 s en haut de la mélodie. */
export const ringOf = (midi: number): number => 3.5 + 6.5 * Math.max(0, Math.min(1, (76 - midi) / 40))

const smooth = (x: number) => x * x * (3 - 2 * x)
/** Nuance composée de l’accompagnement à la fraction `x` de la phrase (crescendo puis decrescendo). */
export const dynamicAt = (d: ComposedPhrase['dynamics'], x: number): number =>
  x <= d.peakAt ? d.from + (d.peak - d.from) * smooth(x / d.peakAt) : d.peak + (d.to - d.peak) * smooth(Math.min(1, (x - d.peakAt) / (1 - d.peakAt)))

/** Session : sac mélangé des phrases (aucune deux fois de suite), dernière phrase et dernière tonalité jouées. */
export interface MelodySession {
  bag: number[]
  last: number | null
  lastKey: KeyName | null
}

export const createSession = (): MelodySession => ({ bag: [], last: null, lastKey: null })

/** Phrase suivante : sac mélangé (Fisher–Yates) ; au remplissage, la première ne peut pas être la dernière jouée. */
export const choosePhrase = (session: MelodySession, rng: Rng, count = PIANO_PHRASES.length): number => {
  if (session.bag.length === 0) {
    const bag = Array.from({ length: count }, (_, i) => i)
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    if (count > 1 && bag[0] === session.last) [bag[0], bag[1]] = [bag[1], bag[0]]
    session.bag = bag
  }
  const next = session.bag.shift() as number
  session.last = next
  return next
}

/** Tonalité selon le niveau : la majeur (parfois fa♯ mineur) aux niveaux 1–2, la mineur ensuite. */
export const keyFor = (level: number, rng: Rng): Key => (level >= 3 ? KEYS.Am : rng() < RELATIVE_MINOR_CHANCE ? KEYS['F#m'] : KEYS.A)

/**
 * Interprète une phrase écrite : tempo de la phrase ±3 %, ritardando sur les derniers temps, respiration aux changements d’accord, jitter
 * d’attaque plus large en fin de phrase, accords roulés de la basse vers l’aigu (10–40 ms), nuance composée ±8 %, mélodie ≈ 20 % au-dessus.
 * Niveaux 3–4 : un peu plus lent, chaque note désaccordée de 10–20 cents. Niveau 5 : plus lent, pédale jamais relevée, notes qui tombent,
 * une ou deux notes hors de la gamme, hauteur qui s’affaisse au fil de la phrase.
 */
export const perform = (p: ComposedPhrase, key: Key, level: number, rng: Rng): NoteEvent[] => {
  const lvl = Math.max(1, Math.min(5, Math.round(level)))
  const written = realize(p, key)
  const { starts, total } = chordStarts(p)
  const tempo = p.bpm * (0.97 + rng() * 0.06) * (lvl === 5 ? 0.88 : lvl >= 3 ? 0.96 : 1)
  const spb = 60 / tempo
  const rit = (lvl === 5 ? 0.35 : 0.2) + rng() * 0.15
  const breath = [0]
  for (let k = 1; k < starts.length; k++) breath.push(breath[k - 1] + rng() * BREATH_MAX)
  const b0 = total - RIT_BEATS
  const time = (b: number) => {
    let k = 0
    while (k + 1 < starts.length && starts[k + 1] <= b + 1e-9) k++
    const late = Math.max(0, b - b0)
    // JITTER_BASE en avance : une attaque anticipée au premier temps ne tombe jamais avant 0 (l’accord roulé reste entier)
    return JITTER_BASE + spb * (b + (rit * late ** 3) / (3 * RIT_BEATS * RIT_BEATS)) + breath[k]
  }

  // niveau 5 : une ou deux notes de mélodie (ni la première ni la dernière) sortent de la gamme
  const melodyIdx = written.flatMap((w, i) => (w.voice === 'melody' ? [i] : []))
  const wrong = new Set<number>()
  if (lvl === 5 && melodyIdx.length > 2) {
    const inner = melodyIdx.slice(1, -1)
    const n = 1 + Math.floor(rng() * 2)
    for (let i = 0; i < n; i++) wrong.add(inner[Math.floor(rng() * inner.length)])
  }

  // groupes de notes simultanées (accords roulés)
  const groups = new Map<number, number[]>()
  written.forEach((w, i) => {
    const g = groups.get(w.beat) ?? []
    g.push(i)
    groups.set(w.beat, g)
  })
  const onset = new Array<number>(written.length)
  for (const [beat, idx] of groups) {
    const progress = beat / total
    const jitter = (rng() * 2 - 1) * (JITTER_BASE + JITTER_END * progress ** 2)
    const spread = ROLL_MIN + rng() * (ROLL_MAX - ROLL_MIN)
    const sorted = idx.slice().sort((a, b) => written[a].midi - written[b].midi)
    sorted.forEach((i, r) => (onset[i] = Math.max(0, time(beat) + jitter + (sorted.length > 1 ? (r * spread) / (sorted.length - 1) : 0))))
  }

  const out: NoteEvent[] = []
  written.forEach((w, i) => {
    const progress = w.beat / total
    const velocity = Math.max(0.05, Math.min(1, dynamicAt(p.dynamics, progress) * VOICE_GAIN[w.voice] * (1 + (rng() * 2 - 1) * VELOCITY_SPREAD)))
    const sign = rng() < 0.5 ? -1 : 1
    const detune = rng()
    const drop = rng()
    let midi = w.midi
    if (wrong.has(i)) midi = inScale(midi - 1, key) ? midi + 1 : midi - 1
    if (lvl === 5) {
      const first = i === melodyIdx[0]
      const last = i === melodyIdx[melodyIdx.length - 1]
      if (w.voice === 'inner' && drop < L5_DROP_INNER) return
      if (w.voice === 'melody' && !first && !last && !wrong.has(i) && drop < L5_DROP_MELODY) return
    }
    const at = onset[i]
    const decay = ringOf(midi)
    const pedal = w.final ? time(total) + FINAL_RING : time(w.pedalUp) + 0.02
    const release = lvl === 5 ? at + decay : Math.max(at + 0.15, pedal)
    const cents = lvl === 5 ? sign * (8 + detune * 10) - L5_DRIFT * progress : lvl >= 3 ? sign * (10 + detune * 10) : 0
    const sag = lvl === 5 ? -(6 + detune * 10) : 0
    out.push({ at, midi, hz: midiToHz(midi), velocity, decay, release, cents, sag, voice: w.voice, chord: w.chord })
  })
  return out.sort((x, y) => x.at - y.at)
}

/**
 * Une phrase pour le niveau donné : phrase composée tirée du sac de la session (jamais deux fois de suite), tonalité selon le niveau,
 * puis interprétation. `session` est mis à jour ; sans lui une session neuve est créée.
 */
export const planPhrase = (level: number, rng: Rng, session: MelodySession = createSession()): NoteEvent[] => {
  const idx = choosePhrase(session, rng)
  const key = keyFor(level, rng)
  session.lastKey = key.name
  return perform(PIANO_PHRASES[idx], key, level, rng)
}

/** Durée (s) jusqu’à la fin du dernier son de la phrase (étouffoir ou résonance naturelle). */
export const phraseDuration = (notes: readonly NoteEvent[]): number => Math.max(0, ...notes.map((n) => Math.min(n.at + n.decay, n.release + DAMPER_TAIL) + 0.1))

/** Constante de décroissance (s) de la charge : le coup de marteau s’efface vite, la résonance reste plus faible. */
const LOAD_TAU = 1.5
/** Charge de référence : au-delà, le bus de la phrase est abaissé d’autant. */
export const LOAD_REF = 1.2

/** Charge maximale : somme des vélocités des notes qui sonnent encore (décroissance exponentielle), mesurée à chaque attaque. */
export const phraseLoad = (notes: readonly NoteEvent[]): number => {
  let max = 0
  for (const t of notes.map((n) => n.at + 0.02)) {
    let s = 0
    for (const n of notes) if (n.at <= t && t < Math.min(n.at + n.decay, n.release)) s += n.velocity * Math.exp(-(t - n.at) / LOAD_TAU)
    max = Math.max(max, s)
  }
  return max
}

/** Gain du bus de la phrase (≤ 1) : réserve de dynamique pour que les notes tenues à la pédale ne s’additionnent pas trop fort. */
export const phraseGain = (notes: readonly NoteEvent[]): number => Math.min(1, LOAD_REF / Math.max(1e-6, phraseLoad(notes)))

export interface PhraseGate {
  /** Horloge murale (ms) et heure prévue (ms) de la prochaine phrase. */
  nowMs: number
  nextAtMs: number
  /** Horloge du contexte (s) et fins d’occupation (s) du leitmotif et des jingles. */
  ctxTime: number
  motifBusyUntil: number
  stingerBusyUntil: number
  muted: boolean
  hidden: boolean
  ducked: boolean
  running: boolean
}

/** Une phrase ne démarre jamais sur un leitmotif ou un jingle, ni en sourdine, onglet caché, finale ou contexte suspendu. */
export const canStartPhrase = (g: PhraseGate): boolean => g.running && !g.muted && !g.hidden && !g.ducked && g.nowMs >= g.nextAtMs && g.motifBusyUntil <= g.ctxTime && g.stingerBusyUntil <= g.ctxTime

/** Délai (s) avant la prochaine phrase après un retour (fin de sourdine, onglet revenu, fin de finale) : pas de départ immédiat. */
export const RESUME_MIN = 8
export const RESUME_MAX = 20
export const resumeDelay = (rng: Rng): number => RESUME_MIN + rng() * (RESUME_MAX - RESUME_MIN)

/** Valeur d’occupation après une coupure anticipée : on ne rabaisse que ce qu’on a posé soi-même (`current === mine`), jamais la valeur d’un autre. */
export const releaseBusy = (current: number, mine: number, previous: number): number => (current === mine ? previous : current)
