import type { Rng } from './rng'

// Les trois paquets de la coupe : chacun a son dos, sa teinte et son tirage d’arcanes (champ `paquet` de la table `arcane`).
export type Paquet = 'nuit' | 'feu' | 'brume'
export const PAQUETS: readonly Paquet[] = ['nuit', 'feu', 'brume']
export const PAQUET_NOMS: Record<Paquet, string> = { nuit: 'Paquet de la Nuit', feu: 'Paquet du Feu', brume: 'Paquet de la Brume' }
// Ce que chaque paquet tend à prédire (affiché en permanence sous la carte de la coupe) : à réécrire librement, une ligne courte, apostrophe typographique.
export const PAQUET_PRESAGES: Record<Paquet, string> = {
  nuit: 'Ce que la nuit voit déjà de vous.',
  feu: 'Coups du sort, éclats et tours qui tombent.',
  brume: 'Spectres du quotidien et petits mystères.',
}
// Symbole de l’emblème de chaque paquet (dos de carte et légende de la coupe).
export const EMBLEMS: Record<Paquet, string> = { nuit: 'moon', feu: 'flame', brume: 'ghost' }
export const isPaquet = (v: unknown): v is Paquet => v === 'nuit' || v === 'feu' || v === 'brume'

/** Ordre des trois paquets dans l’éventail, mélangé à chaque visite (Fisher-Yates avec le Rng injecté). */
export const shufflePaquets = (rng: Rng): Paquet[] => {
  const a = [...PAQUETS]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
