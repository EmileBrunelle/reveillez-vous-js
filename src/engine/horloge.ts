import { HORLOGE_LIGNES, type FenetreHoraire } from '../content/horloge'
import type { Rng } from './rng'

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Part des portes admissibles où la voyante remarque l’heure (le 31 octobre : toujours, une fois). */
export const HORLOGE_CHANCE = 0.35
/** Clé de session : la remarque n’est faite qu’une fois par session. */
export const HORLOGE_KEY = 'rvj-horloge'

const FORMAT_HEURE = new Intl.DateTimeFormat('fr-CA', { hour: 'numeric', minute: '2-digit' })
/** Heure locale façon Québec via Intl (« 3 h 12 », « 23 h 05 ») ; espaces rendues insécables pour ne jamais couper l’heure en fin de ligne. */
export const heureQc = (now: Date): string => FORMAT_HEURE.format(now).replace(/\s/g, '\u00a0')

/** Fenêtre horaire de `now` (heure locale) : 31 octobre > minuit (23 h 50 à 0 h 10) > nuit (0 h à 4 h 59) > matin (5 h à 8 h 59) > soir (18 h et plus) ; null le reste du jour. */
export const fenetreHoraire = (now: Date): FenetreHoraire | null => {
  if (now.getMonth() === 9 && now.getDate() === 31) return 'halloween'
  const min = now.getHours() * 60 + now.getMinutes()
  if (min >= 23 * 60 + 50 || min <= 10) return 'minuit'
  if (min < 5 * 60) return 'nuit'
  if (min < 9 * 60) return 'matin'
  if (min >= 18 * 60) return 'soir'
  return null
}

/**
 * Remarque sur l’heure, ou null. Au plus une par session (`store` = sessionStorage) ; hors fenêtre, rien n’est consommé.
 * Le 31 octobre elle tombe à coup sûr à la première porte admissible, sinon avec `HORLOGE_CHANCE`.
 */
export const nextClockLine = (now: Date, rng: Rng, store: Store): string | null => {
  const fenetre = fenetreHoraire(now)
  if (!fenetre) return null
  try {
    if (store.getItem(HORLOGE_KEY)) return null
  } catch {
    return null
  }
  if (fenetre !== 'halloween' && rng() >= HORLOGE_CHANCE) return null
  const lignes = HORLOGE_LIGNES[fenetre]
  const ligne = lignes[Math.floor(rng() * lignes.length)]
  try {
    store.setItem(HORLOGE_KEY, '1')
  } catch {
    /* stockage plein ou refusé : pas grave */
  }
  return ligne.replaceAll('{heure}', heureQc(now))
}
