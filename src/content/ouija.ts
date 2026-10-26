/** Mots de la planche Ouija (voyance, Halloween, réveil), 4 à 6 lettres une fois ramenés à A–Z. Forme affichée, avec accents (« œ » compte pour OE). */
const SHOWN: readonly string[] = [
  'lune',
  'sort',
  'brume',
  'nuit',
  'chat',
  'voix',
  'ombre',
  'rêve',
  'carte',
  'aura',
  'porte',
  'écho',
  'signe',
  'masque',
  'réveil',
  'aube',
  'tarot',
  'étoile',
  'augure',
  'cierge',
  'œil',
  'tombe',
]

/** Forme de planche : majuscules sans accents, A à Z seulement (la planche n’a pas d’accents ; œ devient OE). */
const toBoard = (w: string) => w.replace(/œ/g, 'oe').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()

export const OUIJA_WORDS: readonly string[] = SHOWN.map(toBoard)
/** Forme de planche → forme affichée accentuée. */
export const OUIJA_SHOWN: Readonly<Record<string, string>> = Object.fromEntries(SHOWN.map((w) => [toBoard(w), w]))
