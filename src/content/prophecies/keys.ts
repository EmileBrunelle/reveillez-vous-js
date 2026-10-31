// Clés typées des tables de la grammaire : une faute de frappe dans un préfixe ou un niveau échoue à `vue-tsc`.
import type { ParanoiaLevel } from '../../engine/paranoia'

/** Niveau de vigilance (1 à 5), le même que celui du moteur. */
export type Level = ParanoiaLevel

/** Préfixes de tables construites avec un niveau (`niveau3`, `bulle2`…). */
export type LevelPrefix = 'niveau' | 'premiere' | 'seche' | 'porte' | 'rate' | 'rappel' | 'onglet' | 'bulle' | 'erreur' | 'question'

/** Clé de table `<préfixe><niveau>`, ex. `tableKey('niveau', 3)` = `'niveau3'`. */
export const tableKey = <P extends LevelPrefix, L extends Level>(prefix: P, level: L): `${P}${L}` => `${prefix}${level}`

/** Tables sans niveau. */
export type PlainKey =
  'gabarit' | 'entrez' | 'erreur_icone' | 'erreur_boutons' | 'industrie' | 'fete' | 'lieu_inexistant' | 'objet' | 'arcane' | 'futur' | 'moment' | 'bonbon' | 'lieu' | 'verset_livre' | 'verset_ref'

/** Toute clé de table connue du contenu (hors variantes `_maj` / `_caps`). */
export type TableKey = PlainKey | `${LevelPrefix}${Level}`
