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

/** Majeur pentatonique élargi (niveaux 1–2) ou mineur pentatonique grave (niveaux 3–5), en la. */
const SCALES = {
  bright: { steps: [0, 2, 4, 7, 9, 12, 14, 16], base: 57, fifth: 7 },
  dark: { steps: [0, 3, 5, 7, 10, 12], base: 45, fifth: 12 },
} as const
const STEPS = [-2, -1, 1, 1, 2] as const
export const ECHO_DELAY = 0.5
export const ECHO_GAIN = 0.22

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/** Bornes de la pause entre deux phrases (s). */
export const GAP_MIN = 40
export const GAP_MAX = 90
export const musicGap = (rng: Rng): number => GAP_MIN + rng() * (GAP_MAX - GAP_MIN)

const pick = <T>(a: readonly T[], rng: Rng): T => a[Math.floor(rng() * a.length)]

/** Une phrase de 4 à 9 notes (plus le dyade et l’écho), avec rubato. Niveau 5 : notes fausses, notes tombées, hauteur qui s’affaisse. */
export const planPhrase = (level: number, rng: Rng): NoteEvent[] => {
  const lvl = Math.max(1, Math.min(5, Math.round(level)))
  const sc = lvl <= 2 ? SCALES.bright : SCALES.dark
  const n = lvl <= 2 ? 6 + Math.floor(rng() * 4) : 4 + Math.floor(rng() * 2)
  const beat = 60 / (63 + rng() * 6)
  let idx = Math.floor(rng() * 3) + 2
  let t = 0
  let kept = 0
  const out: NoteEvent[] = []
  for (let i = 0; i < n; i++) {
    idx = Math.max(0, Math.min(sc.steps.length - 1, idx + pick(STEPS, rng)))
    let midi: number = sc.base + sc.steps[idx]
    const cents = lvl >= 3 ? (rng() < 0.5 ? -1 : 1) * (lvl === 5 ? 20 + rng() * 25 : 15 + rng() * 15) : 0
    const velocity = 0.55 + rng() * 0.35
    const dyad = rng() < 0.3
    // niveau 5 : une note sur quatre est fausse (demi-ton), une sur cinq tombe (jamais en dessous de trois notes jouées)
    if (lvl === 5 && rng() < 0.25) midi += rng() < 0.5 ? -1 : 1
    const dropped = lvl === 5 && rng() < 0.2 && kept + (n - i - 1) >= 3
    if (!dropped) {
      kept++
      const sag = lvl === 5 ? -(10 + i * 8 + rng() * 15) : 0
      const midis = dyad ? [midi, midi + sc.fifth] : [midi]
      for (const m of midis) {
        const decay = m < 57 ? 5.5 : 4.5
        out.push({ at: t, midi: m, hz: midiToHz(m), velocity, decay, cents, sag, echo: false })
        out.push({ at: t + ECHO_DELAY, midi: m, hz: midiToHz(m), velocity: velocity * ECHO_GAIN, decay: 3, cents, sag, echo: true })
      }
    }
    t += beat * (lvl <= 2 ? 1 + rng() * 0.9 : 1.8 + rng() * 1.6)
  }
  return out
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
