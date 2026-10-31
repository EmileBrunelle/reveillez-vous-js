// Utilitaires de construction du contenu (aucune donnée ici).
import type { Grammar, ObjectTable, StringTable } from '../../engine/grammar'

export const cap = (s: string) => s.charAt(0).toLocaleUpperCase('fr-CA') + s.slice(1)
export const up = (s: string) => s.toLocaleUpperCase('fr-CA')

/** Chaque champ `x` d’une paire reçoit aussi `x_maj` (1re lettre en majuscule) et `x_caps` (TOUT EN MAJUSCULES). */
export const paired = (entries: Record<string, string>[]): ObjectTable => {
  return entries.map((e) => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(e)) {
      out[k] = v
      out[`${k}_maj`] = cap(v)
      out[`${k}_caps`] = up(v)
    }
    return out
  })
}

/** Table de chaînes `name` + sa variante `name_caps` (pour le niveau 5). */
export const withCaps = (name: string, items: StringTable): Grammar => {
  return { [name]: items, [`${name}_maj`]: items.map(cap), [`${name}_caps`]: items.map(up) }
}
