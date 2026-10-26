import type { Grammar } from './grammar'

/** Un arcane possible du tirage. La clé d’identité est le nom (unique dans le contenu, voir tests/content/prophecies.test.ts) : les numéros peuvent se répéter (« XIII bis », « XIII ½ »). */
export interface CollectionEntry {
  nom: string
  numero: string
  symbole: string
}

/** `seen` : noms des arcanes vus, dans l’ordre d’obtention ; `fresh` : dernier arcane nouveau pas encore consulté dans la collection. */
export interface Collection {
  seen: string[]
  fresh: string | null
}

export const emptyCollection = (): Collection => ({ seen: [], fresh: null })

/** Tous les arcanes que la lecture peut tirer : la table `arcane` du contenu, sans liste en double. */
export const arcaneInventory = (grammar: Grammar): CollectionEntry[] => {
  const table = grammar.arcane
  if (!Array.isArray(table)) return []
  const out: CollectionEntry[] = []
  for (const a of table) {
    if (typeof a !== 'object' || !a.nom || out.some((e) => e.nom === a.nom)) continue
    out.push({ nom: a.nom, numero: a.numero ?? '', symbole: a.symbole ?? '' })
  }
  return out
}

/** Ajoute un arcane vu ; idempotent (même objet renvoyé si déjà vu). Un nouvel arcane devient le « nouveau » à mettre en évidence. */
export const withSeen = (c: Collection, nom: string): Collection => (nom === '' || c.seen.includes(nom) ? c : { seen: [...c.seen, nom], fresh: nom })

/** Le « nouveau » a été consulté. */
export const consulted = (c: Collection): Collection => (c.fresh === null ? c : { ...c, fresh: null })

/** Nombre d’arcanes vus qui font partie de l’inventaire (un nom disparu du contenu ne compte pas). */
export const seenCount = (c: Collection, inventory: CollectionEntry[]): number => inventory.filter((e) => c.seen.includes(e.nom)).length

/** Lecture tolérante du JSON stocké : toute valeur illisible donne une collection vide. */
export const parseCollection = (raw: string): Collection => {
  try {
    const o: unknown = JSON.parse(raw)
    if (typeof o !== 'object' || o === null) return emptyCollection()
    const m = o as Record<string, unknown>
    const seen = Array.isArray(m.seen) ? [...new Set(m.seen.filter((s): s is string => typeof s === 'string' && s !== ''))] : []
    const fresh = typeof m.fresh === 'string' && seen.includes(m.fresh) ? m.fresh : null
    return { seen, fresh }
  } catch {
    return emptyCollection()
  }
}
