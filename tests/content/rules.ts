/** Règles de contenu partagées par les suites de tests (voir AGENTS.md, « Content rules »). */
export const BANNED = ['5G', 'vaccin', 'lézard', 'CIA', 'glowie', 'terre plate', 'fou', 'folle', 'schizo', 'psychose', 'dément', 'cinglé']
export const RELIGION = ['pape', 'papesse', 'dieu', 'diable', 'jugement']
export const CONTRACTIONS = [' de le ', ' de les ', ' à le ', ' à les ']
export const bannedRe = (w: string) => new RegExp(`(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`, 'iu')

/** Néologismes interdits dans les textes publics (UQAM : pas d’iel, celleux, toustes…). */
export const INCLUSIVE_BANNED = /(?<![\p{L}])(iel|iels|celleux|toustes)(?![\p{L}])/iu

/**
 * « ils » / « elles » tolérés : l’entrée contient l’un de ces extraits et le pronom désigne des objets ou des animaux
 * (cartes, drones, preuves…), jamais des personnes indéterminées. Les inversions (« évitent-ils ») sont ignorées.
 */
export const PRONOUN_ALLOWLIST = [
  'Elles ont aussi vu la rondelle', // les cartes
  'Elles voient aussi la 77ᵉ', // les cartes
  'Elles ne le diront pas', // les cartes
  'Elles sont patientes', // les cartes
  'Elles mentent aussi', // les cartes
  'Ils attendent {moment}', // les oiseaux-drones
  'ILS SERONT TROIS', // la boule de cristal et l’objet tiré
  'ELLES EN AVAIENT PRÉVU QUATRE', // les cartes
  'Elles sont dans un sac à bonbons', // les preuves
  'Elles s’en lassent', // les cartes
]

/** Entrées de texte courant de la grammaire (chaînes et champs des tables à objets), sauf les versets (données). */
export const runningTextEntries = (g: Record<string, unknown>): { key: string; text: string }[] => {
  const skip = new Set(['verset_livre', 'verset_ref'])
  const out: { key: string; text: string }[] = []
  for (const [key, table] of Object.entries(g)) {
    if (skip.has(key) || !Array.isArray(table)) continue
    for (const e of table) {
      if (typeof e === 'string') out.push({ key, text: e })
      else for (const [field, v] of Object.entries(e as Record<string, string>)) out.push({ key: `${key}.${field}`, text: v })
    }
  }
  return out
}
