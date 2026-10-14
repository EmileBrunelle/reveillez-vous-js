import { expandTemplate, type Grammar } from './grammar'
import type { Rng } from './rng'
import { drawPersisted } from './shuffleBag'
import { isPaquet, type Paquet } from './paquets'
import { arcaneIndex } from '../stores/progress'

export interface Arcane {
  /** Roman numeral (« XVIII », « XIII bis »). */
  numero: string
  nom: string
  /** Emblem id understood by TarotEmblem (unknown = fallback eye). */
  symbole: string
  /** Paquet de la coupe auquel la carte appartient. */
  paquet: Paquet
}

export interface Prophecy {
  question: string
  body: string
  verse: string
  arcane: Arcane
}

export const EMPTY_ARCANE: Arcane = { numero: '0', nom: 'Le Mat', symbole: 'fool', paquet: 'brume' }

const strings = (grammar: Grammar, key: string): string[] => {
  const t = grammar[key]
  return Array.isArray(t) && t.every((x) => typeof x === 'string') ? (t as string[]) : []
}

/** Prophecy templates of a level: grammar key `niveau<N>` (`question|corps|verset`). */
export const templatesFor = (grammar: Grammar, level: number) => strings(grammar, `niveau${level}`)
/** Door knock lines of a level: grammar key `porte<N>`. */
export const doorLinesFor = (grammar: Grammar, level: number) => strings(grammar, `porte${level}`)

/** Draw an arcane, preferring those of `paquet` tagged for `level` (`niveaux`); then any deck's arcana of that level, then any arcane; EMPTY_ARCANE when no table. */
export const drawArcane = (grammar: Grammar, level: number, rng: Rng, paquet?: Paquet): Arcane => {
  const table = grammar.arcane
  if (!Array.isArray(table) || table.length === 0 || typeof table[0] === 'string') return EMPTY_ARCANE
  const all = table as Record<string, string>[]
  const fit = all.filter((a) => a.niveaux?.includes(String(level)))
  const mine = paquet ? fit.filter((a) => a.paquet === paquet) : fit
  const pool = mine.length > 0 ? mine : fit.length > 0 ? fit : all
  const { numero = '', nom = '', symbole = '', paquet: p } = pool[Math.floor(rng() * pool.length)]
  return { numero, nom, symbole, paquet: isPaquet(p) ? p : (paquet ?? 'nuit') }
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Draw the next prophecy of `level` (arcane taken from the chosen `paquet`) through the persisted shuffle bag, and expand it. */
export const nextProphecy = (grammar: Grammar, level: number, store: Store, rng: Rng, paquet?: Paquet): Prophecy => {
  const templates = templatesFor(grammar, level)
  if (templates.length === 0) return { question: '', body: '', verse: '', arcane: EMPTY_ARCANE }
  let tpl = templates[drawPersisted(store, `niveau${level}`, templates.length, rng)]
  // Verset = livre + référence : le livre passe par un sac persisté (pas de répétition avant d’avoir tout vu,
  // donc jamais deux fois le même verset de suite), la référence est tirée au hasard.
  // Repli : ancienne table `verset` (chaînes complètes) si les deux nouvelles tables manquent.
  if (tpl.includes('{verset}')) {
    const livres = strings(grammar, 'verset_livre')
    const refs = strings(grammar, 'verset_ref')
    const anciens = strings(grammar, 'verset')
    let verset = ''
    if (livres.length > 0 && refs.length > 0) {
      verset = `${livres[drawPersisted(store, 'verset_livre', livres.length, rng)]} ${refs[Math.floor(rng() * refs.length)]}`
    } else if (anciens.length > 0) {
      verset = anciens[drawPersisted(store, 'verset', anciens.length, rng)]
    }
    if (verset) tpl = tpl.replaceAll('{verset}', () => verset)
  }
  const [question = '', body = '', verse = ''] = expandTemplate(grammar, tpl, rng).split('|')
  return { question, body, verse, arcane: drawArcane(grammar, level, rng, paquet) }
}

/** Next line of table `key` (shuffle bag, expanded), or `fallback` when the table is missing. */
export const nextLine = (grammar: Grammar, key: string, store: Store, rng: Rng, fallback: string): string => {
  const lines = strings(grammar, key)
  if (lines.length === 0) return fallback
  return expandTemplate(grammar, lines[drawPersisted(store, key, lines.length, rng)], rng)
}

/** Nom de l’arcane d’indice `index` (voir `arcaneIndex`) dans la table `arcane`, ou null. Plusieurs cartes peuvent partager un indice (« XIII bis », « XIII ½ ») : le rng départage. */
export const arcaneNameAt = (grammar: Grammar, index: number | null, rng: Rng, nom?: string | null): string | null => {
  const table = grammar.arcane
  if (!Array.isArray(table) || typeof table[0] !== 'object') return null
  // Le nom enregistré gagne (même indice, cartes différentes) ; sinon repli sur l’indice (anciennes sauvegardes).
  if (nom && (table as Record<string, string>[]).some((a) => a.nom === nom)) return nom
  if (index === null) return null
  const found = (table as Record<string, string>[]).filter((a) => a.nom && arcaneIndex(a.numero ?? '') === index)
  return found.length > 0 ? found[Math.floor(rng() * found.length)].nom : null
}

/** Nom de carte au milieu d’une phrase : l’article initial passe en minuscules (« La Lune » -> « la Lune », « L’Étoile » -> « l’Étoile »). */
export const lowerArticle = (nom: string): string => nom.replace(/^(?:(?:Le|La|Les)(?=\s)|L’)/u, (a) => a.toLocaleLowerCase('fr-CA'))

/** Tables temporaires du rappel : `carte` (milieu de phrase), `carte_maj` (nom tel quel, début de phrase), `carte_caps`. */
export const carteTables = (nom: string): Grammar => ({ carte: [lowerArticle(nom)], carte_maj: [nom], carte_caps: [nom.toLocaleUpperCase('fr-CA')] })

/** Part des visites (niveau 2+, carte précédente connue) où la porte rappelle la carte précédente. */
export const RAPPEL_CHANCE = 0.5

/**
 * Next door knock line of `level` (shuffle bag), or `fallback` when the key is missing.
 * Avec une mémoire (`lastArcane` connu, niveau ≥ 2), environ une fois sur deux la ligne vient de `rappel<N>`,
 * où `{carte}` (+ `_maj`, `_caps`) est le nom de la carte précédente.
 */
export const nextDoorLine = (grammar: Grammar, level: number, store: Store, rng: Rng, fallback: string, memory?: { lastArcane: number | null; lastNom?: string | null }): string => {
  if (level >= 2 && memory && memory.lastArcane !== null && strings(grammar, `rappel${level}`).length > 0 && rng() < RAPPEL_CHANCE) {
    const nom = arcaneNameAt(grammar, memory.lastArcane, rng, memory.lastNom)
    if (nom) {
      return nextLine({ ...grammar, ...carteTables(nom) }, `rappel${level}`, store, rng, fallback)
    }
  }
  return nextLine(grammar, `porte${level}`, store, rng, fallback)
}

/** Titre de l’onglet quand il est caché (table `onglet<N>`, sac persisté), ou `fallback`. */
export const nextTabTitle = (grammar: Grammar, level: number, store: Store, rng: Rng, fallback: string): string => nextLine(grammar, `onglet${level}`, store, rng, fallback)

/** Une bulle ou fausse erreur « Titre|Texte » de la table `key` (sac persisté) ; null si la table manque. */
export const nextTitled = (grammar: Grammar, key: string, store: Store, rng: Rng): { title: string; text: string } | null => {
  const line = nextLine(grammar, key, store, rng, '')
  if (!line) return null
  const [title = '', ...rest] = line.split('|')
  return { title, text: rest.join('|') }
}

/** Mockery after a failed rhythm (table `rate<N>`). */
export const nextFailLine = (grammar: Grammar, level: number, store: Store, rng: Rng, fallback: string): string => nextLine(grammar, `rate${level}`, store, rng, fallback)

/** Give-up line after three failures (table `entrez`). */
export const nextEntrezLine = (grammar: Grammar, store: Store, rng: Rng, fallback: string): string => nextLine(grammar, 'entrez', store, rng, fallback)
