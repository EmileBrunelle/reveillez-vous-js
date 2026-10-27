// Textes et durées des activités « à la Dumb Ways to Die » : un verbe, une barre de temps, une issue d’environ 1 s.
// Les blagues visent les lieux et les objets, jamais les personnes (voir AGENTS.md).
export type TimedActivity = 'candles' | 'wisps' | 'ouija' | 'windows'

export interface ActivityPrompt {
  /** Verbe géant à l’impératif (forme « vous »). */
  verb: string
  /** Temps accordé (ms) ; plafond MAX_ACTIVITY_MS. */
  ms: number
  win: string
  fail: string
}

export const ACTIVITY_PROMPTS: Record<TimedActivity, ActivityPrompt> = {
  candles: { verb: 'ALLUMEZ !', ms: 10_000, win: 'LUMIÈRE !', fail: 'Le courant d’air a gagné.' },
  wisps: { verb: 'ATTRAPEZ !', ms: 14_000, win: 'ATTRAPÉS !', fail: 'Partis au dépanneur.' },
  ouija: { verb: 'ÉPELEZ !', ms: 16_000, win: 'MOT REÇU !', fail: 'La planche a perdu le fil.' },
  windows: { verb: 'FRAPPEZ !', ms: 14_000, win: 'ON A OUVERT !', fail: 'Personne à la maison.' },
}
