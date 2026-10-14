import type { Rng } from './rng'

export type StringTable = string[]
export type ObjectTable = Record<string, string>[]
export type Grammar = Record<string, StringTable | ObjectTable>

const MAX_DEPTH = 8
const TOKEN = /\{([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?\}/g

const pick = <T>(items: T[], rng: Rng): T => {
  return items[Math.floor(rng() * items.length)]
}

/**
 * Expand `startKey` (a string table) into text.
 * `{table}` -> random string; `{table.field}` -> field of an object entry.
 * Object entries are picked once per expansion (memoized) so fields stay paired.
 */
export const expand = (grammar: Grammar, startKey: string, rng: Rng): string => {
  return run(grammar, rng, (resolve) => resolve(startKey, undefined, 0))
}

/** Expand a template string (may reference tables of `grammar`) with the same rules as `expand`. */
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
    if (typeof table[0] === 'string') {
      raw = pick(table as StringTable, rng)
    } else {
      let entry = memo.get(key)
      if (!entry) {
        entry = pick(table as ObjectTable, rng)
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
