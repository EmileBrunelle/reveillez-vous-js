import { expandTemplate, type Grammar } from './grammar'
import type { Rng } from './rng'
import { drawPersisted } from './shuffleBag'
import { isPaquet, type Paquet } from './paquets'
import { returnGrammar } from '../content/finale'
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

/** Part des lectures qui viennent des prophéties sèches (tables `seche<N>`), soit environ 1 sur 8. */
export const SECHE_CHANCE = 0.125
/** Prophéties sèches d’un niveau : table `seche<N>`. */
export const secheFor = (grammar: Grammar, level: number) => strings(grammar, `seche${level}`)

/** Prophéties de la toute première lecture d’une session : table `premiere1`. */
export const premiereFor = (grammar: Grammar) => strings(grammar, 'premiere1')

/** Draw the next prophecy of `level` (arcane taken from the chosen `paquet`) through the persisted shuffle bag, and expand it. Environ 1 lecture sur 8 (SECHE_CHANCE) vient plutôt de la table `seche<N>`, avec son propre sac. */
export const nextProphecy = (grammar: Grammar, level: number, store: Store, rng: Rng, paquet?: Paquet, premiere = false): Prophecy => {
  // Toute première lecture de la session : table dédiée `premiere1` (voyance pure, sans clin d’œil complotiste), pas de prophétie sèche.
  const firsts = premiere && level === 1 ? premiereFor(grammar) : []
  const templates = firsts.length > 0 ? firsts : templatesFor(grammar, level)
  if (templates.length === 0) return { question: '', body: '', verse: '', arcane: EMPTY_ARCANE }
  const seches = firsts.length > 0 ? [] : secheFor(grammar, level)
  let tpl: string
  if (firsts.length > 0) tpl = firsts[drawPersisted(store, 'premiere1', firsts.length, rng)]
  else if (seches.length > 0 && rng() < SECHE_CHANCE) tpl = seches[drawPersisted(store, `seche${level}`, seches.length, rng)]
  else tpl = templates[drawPersisted(store, `niveau${level}`, templates.length, rng)]
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

/** Première réplique de la porte au retour après une finale (table `retour`, sac persisté), ou `fallback`. */
export const nextReturnLine = (store: Store, rng: Rng, fallback: string): string => nextLine(returnGrammar, 'retour', store, rng, fallback)

/** Titre de l’onglet quand il est caché (table `onglet<N>`, sac persisté), ou `fallback`. */
export const nextTabTitle = (grammar: Grammar, level: number, store: Store, rng: Rng, fallback: string): string => nextLine(grammar, `onglet${level}`, store, rng, fallback)

/** Une bulle ou fausse erreur « Titre|Texte » de la table `key` (sac persisté) ; null si la table manque. */
export const nextTitled = (grammar: Grammar, key: string, store: Store, rng: Rng): { title: string; text: string } | null => {
  const line = nextLine(grammar, key, store, rng, '')
  if (!line) return null
  const [title = '', ...rest] = line.split('|')
  return { title, text: rest.join('|') }
}

export type ErrorIcon = 'stop' | 'warn' | 'info' | 'question'
export interface FakeError {
  title: string
  text: string
  icon: ErrorIcon
  buttons: string[]
}
const ICONS: readonly ErrorIcon[] = ['stop', 'warn', 'info', 'question']

const pickOf = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)]

/**
 * Fausse erreur Windows 98 du niveau `level` : message « Titre|Texte » tiré du sac persisté `erreur<N>` (aucun message ne revient avant
 * d’avoir tout vu, d’une visite à l’autre), icône et boutons tirés des tables `erreur_icone` / `erreur_boutons` (« Réessayer/Annuler »).
 * `seen` = messages déjà affichés pendant cette visite : un message n’y est jamais répété (un retour de sac ne peut donc pas le ramener).
 * Null si la table manque ou si tout a déjà été vu.
 */
export const nextFakeError = (grammar: Grammar, level: number, store: Store, rng: Rng, seen: Set<string>): FakeError | null => {
  const key = `erreur${level}`
  const lines = strings(grammar, key)
  let raw: string | null = null
  for (let i = 0; i < lines.length && raw === null; i++) {
    const candidate = lines[drawPersisted(store, key, lines.length, rng)]
    if (!seen.has(candidate)) raw = candidate
  }
  if (raw === null) return null
  seen.add(raw)
  const [title = '', ...rest] = expandTemplate(grammar, raw, rng).split('|')
  const icons = strings(grammar, 'erreur_icone').filter((i): i is ErrorIcon => (ICONS as readonly string[]).includes(i))
  const sets = strings(grammar, 'erreur_boutons')
  const buttons = (sets.length > 0 ? pickOf(sets, rng) : 'OK').split('/')
  return { title, text: rest.join('|'), icon: icons.length > 0 ? pickOf(icons, rng) : 'stop', buttons }
}

/** Mockery after a failed rhythm (table `rate<N>`). */
export const nextFailLine = (grammar: Grammar, level: number, store: Store, rng: Rng, fallback: string): string => nextLine(grammar, `rate${level}`, store, rng, fallback)

/** Give-up line after three failures (table `entrez`). */
export const nextEntrezLine = (grammar: Grammar, store: Store, rng: Rng, fallback: string): string => nextLine(grammar, 'entrez', store, rng, fallback)
