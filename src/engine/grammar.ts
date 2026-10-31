import type { Rng } from './rng'
import type { ParanoiaLevel } from './paranoia'

export type StringTable = string[]
/** Entrées à champs appariés (`{table.champ}`). */
export type ObjectTable = Record<string, string>[]
/** Carte de la coupe : `niveaux` = niveaux où elle est privilégiée (jamais développé dans un gabarit). */
export type ArcaneRow = { numero: string; nom: string; symbole: string; paquet: string; niveaux: readonly ParanoiaLevel[] }
export type ArcaneTable = ArcaneRow[]
export type Grammar = Record<string, StringTable | ObjectTable | ArcaneTable>
type Table = Grammar[string]

/** Gabarit de prophétie : les trois champs sont développés ensemble (une seule mémoïsation), dans cet ordre. */
export type Gabarit = { question: string; corps: string; verset: string }
/** Bulle ou fausse erreur : titre et texte développés ensemble. */
export type Titre = { titre: string; texte: string }

// Les tables sont homogènes (vérifié par les tests de contenu) : seul le premier élément décide, ce qui garde ces gardes bon marché
// (elles servent à chaque jeton). Une table vide n’est ni l’une ni l’autre ; `run` la rejette avant de les consulter.
/** Table de chaînes non vide : `{table}` en tire une au hasard. */
export const isStringTable = (t: Table | undefined): t is StringTable => t !== undefined && t.length > 0 && typeof t[0] === 'string'
/** Table d’entrées à champs appariés non vide : `{table.champ}`. */
export const isObjectTable = (t: Table | undefined): t is ObjectTable | ArcaneTable => t !== undefined && t.length > 0 && typeof t[0] === 'object' && t[0] !== null

const isFields = (x: unknown, names: readonly string[]): boolean => typeof x === 'object' && x !== null && names.every((n) => typeof (x as Record<string, unknown>)[n] === 'string')
/** Entrée de table qui a les trois champs d’un gabarit de prophétie. */
export const isGabarit = (x: unknown): x is Gabarit => isFields(x, ['question', 'corps', 'verset'])
/** Entrée de table qui a les deux champs d’une bulle ou d’une fausse erreur. */
export const isTitre = (x: unknown): x is Titre => isFields(x, ['titre', 'texte'])

const MAX_DEPTH = 8
const TOKEN = /\{([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?\}/g

const pick = <T>(items: readonly T[], rng: Rng): T => {
  return items[Math.floor(rng() * items.length)]
}

/**
 * Développe `startKey` (une table de chaînes) en texte.
 * `{table}` -> chaîne aléatoire ; `{table.field}` -> champ d’une entrée objet.
 * Les entrées objet sont tirées une seule fois par expansion (mémoïsées) pour que les champs restent appariés.
 */
export const expand = (grammar: Grammar, startKey: string, rng: Rng): string => {
  return run(grammar, rng, (resolve) => resolve(startKey, undefined, 0))
}

/** Développe une chaîne gabarit (qui peut référencer des tables de `grammar`) avec les mêmes règles que `expand`. */
export const expandTemplate = (grammar: Grammar, template: string, rng: Rng): string => {
  return run(grammar, rng, (_, render) => render(template, 0))
}

/**
 * Développe tous les champs de `entry` (dans l’ordre de ses clés) avec une seule mémoïsation : une table à paires citée
 * par plusieurs champs donne la même entrée partout. Même tirage qu’un gabarit `a|b|c` développé d’un bloc.
 */
export const expandFields = <T extends Record<string, string>>(grammar: Grammar, entry: T, rng: Rng): T => {
  const out: Record<string, string> = {}
  run(grammar, rng, (_, render) => {
    for (const [name, template] of Object.entries(entry)) out[name] = render(template, 0)
    return ''
  })
  return out as T
}

type Resolve = (key: string, field: string | undefined, depth: number) => string
type Render = (text: string, depth: number) => string

const run = (grammar: Grammar, rng: Rng, start: (resolve: Resolve, render: Render) => string): string => {
  const memo = new Map<string, ObjectTable[number] | ArcaneRow>()

  const resolve: Resolve = (key, field, depth) => {
    const table = grammar[key]
    if (!table || table.length === 0) throw new Error(`Grammar: unknown or empty table « ${key} »`)
    let raw: string
    if (isStringTable(table)) {
      raw = pick(table, rng)
    } else {
      let entry = memo.get(key)
      if (!entry) {
        entry = pick<ObjectTable[number] | ArcaneRow>(table, rng)
        memo.set(key, entry)
      }
      const value: unknown = field ? Reflect.get(entry, field) : undefined
      if (typeof value !== 'string') {
        throw new Error(`Grammar: unknown field « ${key}.${field ?? ''} »`)
      }
      raw = value
    }
    return render(raw, depth + 1)
  }

  const render: Render = (text, depth) => {
    if (depth > MAX_DEPTH) return text
    return text.replace(TOKEN, (_, key: string, field?: string) => resolve(key, field, depth))
  }

  return start(resolve, render)
}
