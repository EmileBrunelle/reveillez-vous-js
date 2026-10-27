import type { Rng } from '../engine/rng'

// Piano génératif clairsemé (esprit C418) : plan d’une phrase, pur et déterministe pour un Rng donné. La synthèse est dans pianoVoice.ts.
export interface NoteEvent {
  /** Départ (s) depuis le début de la phrase. */
  at: number
  midi: number
  hz: number
  /** 0–1. */
  velocity: number
  /** Durée de résonance (s) de la note : le grave dure plus longtemps. */
  decay: number
  /** Désaccord fixe (cents) : niveaux 3–4 (flottant), 5 (cassé). */
  cents: number
  /** Chute de hauteur (cents) sur la durée de la note : niveau 5 seulement. */
  sag: number
  /** Écho par répétition, faible et plus bref. */
  echo: boolean
}

/** Gammes de la mélodie en la : majeur (niveaux 1–2), mineur naturel (niveaux 3–5 : même contour, décalage modal). Degrés 0–6 par octave. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const
const MINOR = [0, 2, 3, 5, 7, 8, 10] as const
const MELODY_BASE = 57 // la 3
const HAND_BASE = 45 // la 2 : main gauche
const DEG_MIN = 0
const DEG_MAX = 9
/** Degrés de repos : tonique (0, 7) et quinte (4). Une question finit sur un degré « ouvert » (2e, 3e, 6e). */
const REST = [0, 4, 7] as const
const OPEN = [1, 2, 5] as const
const STEP_POOL = [-1, -1, 1, 1, 1, -1, -2, 2] as const
const LEAPS = [-4, -3, 3, 4] as const
const BEAT_POOL = [0.5, 1, 1, 1.5, 2] as const
const HOLD_BEATS = 4
const RUBATO = 0.035
export const ECHO_DELAY = 0.5
export const ECHO_GAIN = 0.22

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/** Bornes de la pause entre deux phrases (s). */
export const GAP_MIN = 40
export const GAP_MAX = 90
export const musicGap = (rng: Rng): number => GAP_MIN + rng() * (GAP_MAX - GAP_MIN)

const pick = <T>(a: readonly T[], rng: Rng): T => a[Math.floor(rng() * a.length)]
const clamp = (d: number) => Math.max(DEG_MIN, Math.min(DEG_MAX, d))

/** Hauteur MIDI d’un degré (entier, éventuellement hors 0–6 : octaves) dans une gamme. */
export const degreeToMidi = (deg: number, scale: readonly number[]): number => MELODY_BASE + 12 * Math.floor(deg / 7) + scale[((deg % 7) + 7) % 7]

/** Motif de session : degrés de gamme et durées (temps). */
export interface Motif {
  degrees: number[]
  beats: number[]
}
export interface MelodySession {
  motif: Motif
  /** Signature (degrés) de la dernière phrase : jamais deux fois la même d’affilée. */
  last: string | null
}

const FALLBACK: Motif = { degrees: [4, 5, 4, 2, 1], beats: [1, 0.5, 0.5, 1, 2] }

/** Contour du motif : au plus un saut, aucune note répétée, fin sur un degré ouvert, durées longues et courtes mêlées. */
export const validMotif = (m: Motif): boolean => {
  const d = m.degrees
  let leaps = 0
  for (let i = 1; i < d.length; i++) {
    const s = Math.abs(d[i] - d[i - 1])
    if (s === 0) return false
    if (s > 2) leaps++
  }
  return leaps <= 1 && (OPEN as readonly number[]).includes(d[d.length - 1]) && m.beats.some((b) => b >= 1.5) && m.beats.some((b) => b <= 1)
}

/** Motif de 4 à 6 notes : surtout par degrés conjoints, un saut au plus. Se génère une fois par session. */
export const createMotif = (rng: Rng): Motif => {
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = 4 + Math.floor(rng() * 3)
    const leapAt = rng() < 0.8 ? 1 + Math.floor(rng() * (n - 1)) : -1
    const degrees = [pick([2, 3, 4], rng)]
    for (let i = 1; i < n; i++) degrees.push(clamp(degrees[i - 1] + (i === leapAt ? pick(LEAPS, rng) : pick(STEP_POOL, rng))))
    const beats = Array.from({ length: n }, (_, i) => (i === n - 1 ? 2 : pick(BEAT_POOL, rng)))
    const m = { degrees, beats }
    if (validMotif(m)) return m
  }
  return { degrees: [...FALLBACK.degrees], beats: [...FALLBACK.beats] }
}

export const createSession = (rng: Rng): MelodySession => ({ motif: createMotif(rng), last: null })

type Answer = 'up' | 'down' | 'end' | 'same'
const ANSWERS: readonly Answer[] = ['up', 'down', 'end', 'same']

/** Réponse : même rythme, transposée d’un degré ou à fin décalée, puis cadence sur la tonique ou la quinte (note tenue, approchée par degrés conjoints). */
const answerOf = (m: Motif, kind: Answer, rng: Rng): Motif => {
  const n = m.degrees.length
  let d = m.degrees.slice(0, n - 1)
  if (kind === 'up') d = d.map((x) => clamp(x + 1))
  else if (kind === 'down') d = d.map((x) => clamp(x - 1))
  else if (kind === 'end') d[n - 2] = clamp(d[n - 2] + (rng() < 0.5 ? -1 : 1))
  else d[n - 2] = clamp(d[n - 2] + (d[n - 2] > 3 ? -1 : 1))
  const pen = d[n - 2]
  // repos le plus proche de l’avant-dernière note parmi ceux qui sont à moins de 3 degrés ; sinon le plus proche
  const near = REST.filter((r) => Math.abs(r - pen) <= 3)
  const target = near.length ? pick(near, rng) : REST.reduce((a, b) => (Math.abs(b - pen) < Math.abs(a - pen) ? b : a))
  if (Math.abs(pen - target) > 2 || pen === target) d[n - 2] = clamp(target + (pen > target ? 1 : pen < target ? -1 : 1))
  d.push(target)
  const beats = m.beats.slice(0, n - 1)
  beats.push(HOLD_BEATS)
  return { degrees: d, beats }
}

/** Variation de la question : telle quelle, dernière note déplacée d’un degré, ou première note allongée. */
const questionOf = (m: Motif, rng: Rng): Motif => {
  const r = rng()
  const d = m.degrees.slice()
  const b = m.beats.slice()
  const n = d.length
  if (r < 0.5) return { degrees: d, beats: b }
  if (r < 0.75) d[n - 1] = clamp(d[n - 1] + (rng() < 0.5 ? -1 : 1))
  else b[0] *= 1.5
  return { degrees: d, beats: b }
}

interface Planned {
  deg: number
  /** Départ en temps depuis le début de la phrase. */
  beat: number
  beats: number
  velocity: number
  /** Jitter de rubato (s). */
  jitter: number
  hold: boolean
}

/**
 * Une phrase : le motif de la session (question) puis une réponse variée qui retombe sur la tonique ou la quinte (note tenue), avec une
 * main gauche discrète (1–2 notes graves). Premier temps (hauteurs, rythme, rubato) identique d’un niveau à l’autre pour un même Rng et une
 * même session ; ensuite le niveau abîme : 3–4 mineur et désaccordé, 5 « cassé » (notes fausses, notes tombées, hauteur qui s’affaisse).
 * `session` (motif + dernière phrase) est mis à jour ; sans lui une session neuve est tirée du Rng.
 */
export const planPhrase = (level: number, rng: Rng, session: MelodySession = createSession(rng)): NoteEvent[] => {
  const lvl = Math.max(1, Math.min(5, Math.round(level)))
  const scale = lvl <= 2 ? MAJOR : MINOR
  const beat = 60 / (60 + rng() * 12)

  // 1. dessin de la phrase (jamais la même deux fois d’affilée)
  let q = questionOf(session.motif, rng)
  let a = answerOf(q, pick(ANSWERS, rng), rng)
  for (let tries = 0; `${q.degrees}|${a.degrees}` === session.last && tries < 16; tries++) {
    q = questionOf(session.motif, rng)
    a = answerOf(q, pick(ANSWERS, rng), rng)
  }
  if (`${q.degrees}|${a.degrees}` === session.last) {
    const d = q.degrees.slice()
    d[d.length - 1] = clamp(d[d.length - 1] + (d[d.length - 1] > 3 ? -1 : 1))
    q = { degrees: d, beats: q.beats }
    a = answerOf(q, 'up', rng)
  }
  session.last = `${q.degrees}|${a.degrees}`

  const melody: Planned[] = []
  let b = 0
  for (const part of [q, a]) {
    part.degrees.forEach((deg, i) => {
      const hold = part === a && i === part.degrees.length - 1
      melody.push({ deg, beat: b, beats: part.beats[i], velocity: hold ? 0.6 : 0.55 + rng() * 0.3, jitter: i === 0 && part === q ? 0 : (rng() * 2 - 1) * RUBATO, hold })
      b += part.beats[i]
    })
    b += 0.5 // souffle entre la question et la réponse
  }
  const answerAt = melody[q.degrees.length].beat
  // main gauche : la tonique au début, parfois la quinte (ou la tonique) à la réponse
  const hand: { midi: number; beat: number; velocity: number }[] = [{ midi: HAND_BASE, beat: 0, velocity: 0.3 + rng() * 0.1 }]
  if (rng() < 0.7) hand.push({ midi: HAND_BASE + (rng() < 0.6 ? 7 : 0), beat: answerAt, velocity: 0.28 + rng() * 0.1 })

  // 2. le niveau abîme
  const out: NoteEvent[] = []
  let kept = 0
  melody.forEach((p, i) => {
    const remaining = melody.length - i - 1
    let midi = degreeToMidi(p.deg, scale)
    const cents = lvl >= 3 ? (rng() < 0.5 ? -1 : 1) * (lvl === 5 ? 20 + rng() * 25 : 15 + rng() * 15) : 0
    if (lvl === 5 && !p.hold && rng() < 0.25) midi += rng() < 0.5 ? -1 : 1
    const dropped = lvl === 5 && !p.hold && rng() < 0.2 && kept + remaining >= 3
    if (dropped) return
    kept++
    const sag = lvl === 5 ? -(10 + i * 4 + rng() * 15) : 0
    const at = Math.max(0, p.beat * beat + p.jitter)
    const decay = p.hold ? 7 : 4.5
    out.push({ at, midi, hz: midiToHz(midi), velocity: p.velocity, decay, cents, sag, echo: false })
    if (p.beats >= 1 && !p.hold) out.push({ at: at + ECHO_DELAY, midi, hz: midiToHz(midi), velocity: p.velocity * ECHO_GAIN, decay: 3, cents, sag, echo: true })
  })
  for (const h of hand) {
    const cents = lvl >= 3 ? (rng() < 0.5 ? -1 : 1) * 15 : 0
    out.push({ at: h.beat * beat, midi: h.midi, hz: midiToHz(h.midi), velocity: h.velocity, decay: 6.5, cents, sag: lvl === 5 ? -12 : 0, echo: false })
  }
  return out.sort((x, y) => x.at - y.at)
}

/** Durée (s) jusqu’à la fin du dernier son de la phrase (résonance comprise). */
export const phraseDuration = (notes: readonly NoteEvent[]): number => Math.max(0, ...notes.map((n) => n.at + n.decay + 0.1))

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
