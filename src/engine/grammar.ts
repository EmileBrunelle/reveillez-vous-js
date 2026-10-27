import type { Rng } from './rng'

export type StringTable = string[]
export type ObjectTable = Record<string, string>[]
export type Grammar = Record<string, StringTable | ObjectTable>

// Les tables sont homogènes (vérifié par les tests de contenu) : seul le premier élément décide, ce qui garde ces gardes bon marché
// (elles servent à chaque jeton). Une table vide n’est ni l’une ni l’autre ; `run` la rejette avant de les consulter.
/** Table de chaînes non vide : `{table}` en tire une au hasard. */
export const isStringTable = (t: StringTable | ObjectTable | undefined): t is StringTable => t !== undefined && t.length > 0 && typeof t[0] === 'string'
/** Table d’entrées à champs appariés non vide : `{table.champ}`. */
export const isObjectTable = (t: StringTable | ObjectTable | undefined): t is ObjectTable => t !== undefined && t.length > 0 && typeof t[0] === 'object' && t[0] !== null

const MAX_DEPTH = 8
const TOKEN = /\{([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?\}/g

const pick = <T>(items: T[], rng: Rng): T => {
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

type Resolve = (key: string, field: string | undefined, depth: number) => string
type Render = (text: string, depth: number) => string

const run = (grammar: Grammar, rng: Rng, start: (resolve: Resolve, render: Render) => string): string => {
  const memo = new Map<string, Record<string, string>>()

  const resolve: Resolve = (key, field, depth) => {
    const table = grammar[key]
    if (!table || table.length === 0) throw new Error(`Grammar: unknown or empty table « ${key} »`)
    let raw: string
    if (isStringTable(table)) {
      raw = pick(table, rng)
    } else {
      let entry = memo.get(key)
      if (!entry) {
        entry = pick(table, rng)
        memo.set(key, entry)
      }
      if (!field || typeof entry[field] !== 'string') {
        throw new Error(`Grammar: unknown field « ${key}.${field ?? ''} »`)
      }
      raw = entry[field]
    }
    return render(raw, depth + 1)
  }

  const render: Render = (text, depth) => {
    if (depth > MAX_DEPTH) return text
    return text.replace(TOKEN, (_, key: string, field?: string) => resolve(key, field, depth))
  }

  return start(resolve, render)
}
