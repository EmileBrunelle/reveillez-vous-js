/** Règles de contenu partagées par les suites de tests (voir AGENTS.md, « Content rules »). */
export const BANNED = ['5G', 'vaccin', 'lézard', 'CIA', 'glowie', 'terre plate', 'fou', 'folle', 'schizo', 'psychose', 'dément', 'cinglé']
export const RELIGION = ['pape', 'papesse', 'dieu', 'diable', 'jugement']
export const CONTRACTIONS = [' de le ', ' de les ', ' à le ', ' à les ']
export const bannedRe = (w: string) => new RegExp(`(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`, 'iu')
