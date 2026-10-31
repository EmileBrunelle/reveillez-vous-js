// Contenu des prophéties par niveau de vigilance (1 à 5) : un fichier par niveau (`niveau1.ts` … `niveau5.ts`), corps seuls.
// Chaque entrée de `propheties`, `premiere` et `seches` est un corps ; le constructeur en fait un gabarit
// `{ question: '{questionN}', corps, verset: '{verset}' }` (N = niveau). Un gabarit complet reste permis
// pour une entrée qui s’écarte de ce motif (autre question ou autre verset).
// `{table}` tire une chaîne ; `{table.champ}` tire un champ d’une table à paires (voir `tables.ts`) ;
// `{verset}` = livre + référence (voir `versets.ts`). Les valeurs peuvent contenir des références imbriquées (profondeur max : 8).
import type { Gabarit, Grammar } from '../../../engine/grammar'
import { niveau1 } from './niveau1'
import { niveau2 } from './niveau2'
import { niveau3 } from './niveau3'
import { niveau4 } from './niveau4'
import { niveau5 } from './niveau5'

/** Un corps (cas courant) ou un gabarit complet (entrée hors motif). */
export type Entree = string | Gabarit

/** Ce qui varie d’un niveau à l’autre ; la question et le verset des gabarits sont déduits. */
export type ContenuNiveau = {
  /** Questions d’accroche (`question<N>`). */
  questions: string[]
  /** Prophéties du niveau (`niveau<N>`). */
  propheties: Entree[]
  /** Prophéties sèches (`seche<N>`). */
  seches: Entree[]
  /** Première lecture de la session (`premiere1`, niveau 1 seulement). */
  premiere?: Entree[]
  /** Rappels de la carte précédente (`rappel<N>`, niveaux 2 à 5). */
  rappels?: string[]
}

const contenus: readonly ContenuNiveau[] = [niveau1, niveau2, niveau3, niveau4, niveau5]

const gabarits = (entrees: Entree[], n: number): Gabarit[] => entrees.map((e) => (typeof e === 'string' ? { question: `{question${n}}`, corps: e, verset: '{verset}' } : e))

/** `niveau1` … `niveau5`, `premiere1` (première lecture) et `seche1` … `seche5` (prophéties sèches), dans l’ordre historique. */
export const niveaux: Grammar = {
  ...Object.fromEntries(
    contenus.flatMap((c, i) => {
      const n = i + 1
      return [[`niveau${n}`, gabarits(c.propheties, n)], ...(c.premiere ? [[`premiere${n}`, gabarits(c.premiere, n)]] : [])]
    }),
  ),
  ...Object.fromEntries(contenus.map((c, i) => [`seche${i + 1}`, gabarits(c.seches, i + 1)])),
}

/** `rappel2` … `rappel5` : la porte se souvient de la carte précédente (`{carte}`, `{carte_maj}`, `{carte_caps}`). */
export const rappels: Grammar = Object.fromEntries(contenus.flatMap((c, i) => (c.rappels ? [[`rappel${i + 1}`, c.rappels]] : [])))

/** `question1` … `question5` : questions d’accroche, première partie des gabarits. */
export const questions: Grammar = Object.fromEntries(contenus.map((c, i) => [`question${i + 1}`, c.questions]))
