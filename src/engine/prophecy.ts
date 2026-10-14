import { expandTemplate, type Grammar } from './grammar'
import type { Rng } from './rng'
import { drawPersisted } from './shuffleBag'

export interface Arcane {
  /** Roman numeral (« XVIII », « XIII bis »). */
  numero: string
  nom: string
  /** Emblem id understood by TarotEmblem (unknown = fallback eye). */
  symbole: string
}

export interface Prophecy {
  question: string
  body: string
  verse: string
  arcane: Arcane
}

export const EMPTY_ARCANE: Arcane = { numero: '0', nom: 'Le Mat', symbole: 'fool' }

const strings = (grammar: Grammar, key: string): string[] => {
  const t = grammar[key]
  return Array.isArray(t) && t.every((x) => typeof x === 'string') ? (t as string[]) : []
}

/** Prophecy templates of a level: grammar key `niveau<N>` (`question|corps|verset`). */
export const templatesFor = (grammar: Grammar, level: number) => strings(grammar, `niveau${level}`)
/** Door knock lines of a level: grammar key `porte<N>`. */
export const doorLinesFor = (grammar: Grammar, level: number) => strings(grammar, `porte${level}`)

/** Draw an arcane, preferring those tagged for `level` (`niveaux`); any arcane when none matches, EMPTY_ARCANE when no table. */
export const drawArcane = (grammar: Grammar, level: number, rng: Rng): Arcane => {
  const table = grammar.arcane
  if (!Array.isArray(table) || table.length === 0 || typeof table[0] === 'string') return EMPTY_ARCANE
  const all = table as Record<string, string>[]
  const fit = all.filter((a) => a.niveaux?.includes(String(level)))
  const pool = fit.length > 0 ? fit : all
  const { numero = '', nom = '', symbole = '' } = pool[Math.floor(rng() * pool.length)]
  return { numero, nom, symbole }
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Draw the next prophecy of `level` through the persisted shuffle bag, and expand it. */
export const nextProphecy = (grammar: Grammar, level: number, store: Store, rng: Rng): Prophecy => {
  const templates = templatesFor(grammar, level)
  if (templates.length === 0) return { question: '', body: '', verse: '', arcane: EMPTY_ARCANE }
  const tpl = templates[drawPersisted(store, `niveau${level}`, templates.length, rng)]
  const [question = '', body = '', verse = ''] = expandTemplate(grammar, tpl, rng).split('|')
  return { question, body, verse, arcane: drawArcane(grammar, level, rng) }
}

/** Next line of table `key` (shuffle bag, expanded), or `fallback` when the table is missing. */
export const nextLine = (grammar: Grammar, key: string, store: Store, rng: Rng, fallback: string): string => {
  const lines = strings(grammar, key)
  if (lines.length === 0) return fallback
  return expandTemplate(grammar, lines[drawPersisted(store, key, lines.length, rng)], rng)
}

/** Next door knock line of `level` (shuffle bag), or `fallback` when the key is missing. */
export const nextDoorLine = (grammar: Grammar, level: number, store: Store, rng: Rng, fallback: string): string =>
  nextLine(grammar, `porte${level}`, store, rng, fallback)

/** Mockery after a failed rhythm (table `rate<N>`). */
export const nextFailLine = (grammar: Grammar, level: number, store: Store, rng: Rng, fallback: string): string =>
  nextLine(grammar, `rate${level}`, store, rng, fallback)

/** Give-up line after three failures (table `entrez`). */
export const nextEntrezLine = (grammar: Grammar, store: Store, rng: Rng, fallback: string): string =>
  nextLine(grammar, 'entrez', store, rng, fallback)
