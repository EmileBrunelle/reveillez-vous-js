// Textes et durées des activités « à la Dumb Ways to Die » : un verbe, une barre de temps, une issue d’environ 1 s.
// Les blagues visent les lieux et les objets, jamais les personnes (voir AGENTS.md).
export type TimedActivity = 'candles' | 'wisps' | 'ouija' | 'windows' | 'crystal'

export interface ActivityPrompt {
  /** Verbe géant à l’impératif (forme « vous »). */
  verb: string
  /** Temps accordé (ms) ; plafond MAX_ACTIVITY_MS. */
  ms: number
  /** Délai (s) avant le jingle de réussite, pour ne pas chevaucher un son existant. */
  winStingerDelay?: number
  win: string
  fail: string
}

export const ACTIVITY_PROMPTS: Record<TimedActivity, ActivityPrompt> = {
  candles: { verb: 'ALLUMEZ !', ms: 10_000, win: 'LUMIÈRE !', fail: 'Le courant d’air a gagné.' },
  wisps: { verb: 'ATTRAPEZ !', ms: 14_000, win: 'ATTRAPÉS !', fail: 'Partis au dépanneur.' },
  // Le jingle de réussite attend la fin du son « au revoir » de la planche (ouijaFarewell, ~1,4 s).
  ouija: { verb: 'ÉPELEZ !', ms: 16_000, winStingerDelay: 1.45, win: 'MOT REÇU !', fail: 'La planche a perdu le fil.' },
  windows: { verb: 'FRAPPEZ !', ms: 14_000, win: 'ON A OUVERT !', fail: 'Personne à la maison.' },
  crystal: { verb: 'ESSUYEZ !', ms: 14_000, win: 'VUE CLAIRE !', fail: 'La brume garde la place.' },
}
