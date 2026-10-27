import { advanceHold } from './candles'
import type { Rng } from './rng'

/** Lettres de la planche, en quatre rangées assez larges pour un doigt sur téléphone. */
export const OUIJA_ROWS: readonly string[] = ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ']
/** Cases de réponse : OUI et NON au-dessus des lettres, AU REVOIR en bas. */
export const OUIJA_YES = 'OUI'
export const OUIJA_NO = 'NON'
export const OUIJA_BYE = 'AU REVOIR'

/** Durée de survol qui valide une lettre. */
export const DWELL_MS = 500

/** Progression de survol d’une lettre (0 à 1) : monte pendant le survol, retombe plus vite sinon. */
export const advanceDwell = (progress: number, hovering: boolean, dtMs: number) => advanceHold(progress, hovering, dtMs, DWELL_MS)

/** Touche tapée → lettre A à Z (accents retirés), ou null pour tout le reste (chiffres, flèches, combinaisons). */
export const normalizeKey = (key: string): string | null => {
  if (key.length !== 1) return null
  const base = key.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
  return /^[A-Z]$/.test(base) ? base : null
}

/** Lettre attendue (null une fois le mot épelé). */
export const nextLetter = (word: string, index: number): string | null => (index < word.length ? word[index] : null)

/** Valide `letter` : l’indice avance si c’est la lettre attendue, sinon il reste (une mauvaise lettre est ignorée). */
export const pressLetter = (word: string, index: number, letter: string): number => (nextLetter(word, index) === letter ? index + 1 : index)

/** Annonce d’une mauvaise lettre : celle qu’on a touchée (pour que deux essais différents changent le texte) et celle qu’on attend. */
export const wrongLetterMessage = (letter: string, expected: string | null): string =>
  expected ? `${letter} : ce n’est pas la bonne lettre. La lettre attendue est ${expected}.` : `${letter} : ce n’est pas la bonne lettre.`

/** Mot tiré au Rng parmi `words`, jamais `previous` quand il y a le choix. */
export const pickWord = (words: readonly string[], rng: Rng, previous?: string): string => {
  const pool = words.length > 1 && previous ? words.filter((w) => w !== previous) : words
  return pool[Math.floor(rng() * pool.length)]
}

/**
 * Nombre de lettres validées au moment où la goutte dérive vers NON (une seule fois, niveau 4 ou plus).
 * Entre 1 et `wordLength - 1` : jamais avant la première lettre ni après la dernière. -1 : pas de dérive.
 */
export const pickDriftAt = (level: number, wordLength: number, rng: Rng): number => (level >= 4 && wordLength >= 2 ? 1 + Math.floor(rng() * (wordLength - 1)) : -1)

/** La dérive part quand le compte de lettres validées atteint `driftAt`, et seulement si elle n’a pas déjà eu lieu. */
export const shouldDrift = (driftAt: number, validated: number, used: boolean) => !used && driftAt >= 0 && validated === driftAt

/** Débord de la goutte autour de son point d’ancrage (px) : la forme s’étend de 20 à gauche et à droite, 34 au-dessus, 18 en dessous. */
export const DROP_EXTENT = { left: 20, right: 20, top: 34, bottom: 18 } as const

/** Ramène le point d’ancrage de la goutte pour que toute sa forme reste dans la scène (`width` × `height`), quelle que soit la cible. */
export const clampDrop = (x: number, y: number, width: number, height: number, extent = DROP_EXTENT) => ({
  x: Math.min(Math.max(x, extent.left), Math.max(extent.left, width - extent.right)),
  y: Math.min(Math.max(y, extent.top), Math.max(extent.top, height - extent.bottom)),
})
