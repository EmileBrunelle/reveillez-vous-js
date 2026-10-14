import type { Rng } from './rng'

// Les trois paquets de la coupe : chacun a son dos, sa teinte et son tirage d’arcanes (champ `paquet` de la table `arcane`).
export type Paquet = 'nuit' | 'feu' | 'brume'
export const PAQUETS: readonly Paquet[] = ['nuit', 'feu', 'brume']
export const PAQUET_NOMS: Record<Paquet, string> = { nuit: 'Paquet de la Nuit', feu: 'Paquet du Feu', brume: 'Paquet de la Brume' }
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
