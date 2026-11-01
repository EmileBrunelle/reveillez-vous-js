// Textes et durées des activités « à la Dumb Ways to Die » : un verbe, une barre de temps, une issue d’environ 1 s.
// Les blagues visent les lieux et les objets, jamais les personnes (voir AGENTS.md).
export type TimedActivity = 'candles' | 'wisps' | 'ouija' | 'windows' | 'crystal' | 'pendulum'

export interface ActivityPrompt {
  /** Verbe géant à l’impératif (forme « vous »). */
  verb: string
  /** Temps accordé (ms) ; plafond MAX_ACTIVITY_MS. */
  ms: number
  /** Délai (s) avant le jingle de réussite, pour ne pas chevaucher un son existant. */
  winStingerDelay?: number
  /** Durée (ms) de l’issue avant la suite ; défaut OUTCOME_MS. */
  outcomeMs?: number
  win: string
  fail: string
}

export const ACTIVITY_PROMPTS: Record<TimedActivity, ActivityPrompt> = {
  candles: { verb: 'ALLUMEZ !', ms: 16_000, win: 'LUMIÈRE !', fail: 'Le courant d’air a gagné.' },
  wisps: { verb: 'ATTRAPEZ !', ms: 18_000, win: 'ATTRAPÉS !', fail: 'Partis au dépanneur.' },
  // Le jingle de réussite attend la fin du son « au revoir » de la planche (ouijaFarewell, ~1,4 s) : l’issue dure assez pour qu’il joue en entier.
  ouija: { verb: 'ÉPELEZ !', ms: 20_000, winStingerDelay: 1.45, outcomeMs: 2600, win: 'MOT REÇU !', fail: 'La planche a perdu le fil.' },
  windows: { verb: 'RETENEZ !', ms: 18_000, win: 'ON A OUVERT !', fail: 'Personne à la maison.' },
  crystal: { verb: 'ESSUYEZ !', ms: 18_000, win: 'VUE CLAIRE !', fail: 'La brume garde la place.' },
  pendulum: { verb: 'ARRÊTEZ !', ms: 18_000, win: 'LE SIGNE EST CLAIR !', fail: 'Le pendule a perdu le nord.' },
}

/** Symboles du pendule : identifiant (l’icône est choisie par le composant) et nom précédé de son article, pour « sur … ». */
export const PENDULUM_SYMBOLS = [
  { id: 'moon', on: 'la lune' },
  { id: 'star', on: 'l’étoile' },
  { id: 'skull', on: 'le crâne' },
  { id: 'eye', on: 'l’œil' },
  { id: 'cat', on: 'le chat' },
  { id: 'ghost', on: 'le fantôme' },
  { id: 'raven', on: 'le corbeau' },
  { id: 'pumpkin', on: 'la citrouille' },
] as const

export type PendulumSymbolId = (typeof PENDULUM_SYMBOLS)[number]['id']

export const PENDULUM_TEXTS = {
  /** Cristal-bouton qui arrête le pendule (nom accessible). */
  stop: 'Arrêter le pendule',
  /** Indications visibles sous le demi-cercle, selon le geste (doigt ou souris). */
  hintTouch: 'Touchez le pendule',
  hintClick: 'Cliquez sur le pendule',
  /** Description du bouton : les trois gestes et le conseil d’anticiper (le cristal glisse avant de s’immobiliser). */
  help: 'Cliquez sur le pendule, touchez-le ou appuyez sur Espace ou Entrée pour l’arrêter. Le cristal glisse encore un peu avant de s’immobiliser : devancez-le.',
  /** Consigne, annoncée au début. */
  ask: (on: string) => `Arrêtez le pendule sur ${on}`,
  /** Après un raté (`held` : symbole où le cristal s’est arrêté, null s’il est resté entre deux), avec la consigne répétée. */
  retry: (held: string | null, on: string, triesLeft: number) =>
    `${held ? `Pas ${held}.` : 'Entre deux signes.'} ${triesLeft > 1 ? 'Encore un essai' : 'Dernière chance'} : arrêtez le pendule sur ${on}.`,
}
