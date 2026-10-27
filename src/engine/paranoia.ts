export type ParanoiaLevel = 1 | 2 | 3 | 4 | 5

/**
 * Associe le nombre de réouvertures de la porte dans ce navigateur à un niveau de paranoïa.
 *
 * Contrat :
 * - `visits` est le nombre de clics sur « Fermer la porte » conservés dans ce navigateur ; entier, >= 0.
 * - Doit retourner un entier de 1 à 5 pour tout `visits` >= 0.
 * - Comportement attendu par défaut : monotone non décroissant (le niveau ne baisse jamais quand les visites augmentent).
 */
// Visites nécessaires pour atteindre chaque niveau (index 0 = niveau 1).
// Montée plus lente : N1 aux visites 0-1, N2 à la 2, N3 aux 3-4, N4 aux 5-6, N5 à la 7, puis la finale.
const THRESHOLDS = [0, 2, 3, 5, 7] as const

export const paranoiaLevel = (visits: number): ParanoiaLevel => {
  const reached = THRESHOLDS.filter((t) => visits >= t).length
  return Math.max(1, reached) as ParanoiaLevel
}

// Le rituel « Toc Toc » se joue à chaque porte du niveau 1 ; dès le niveau 2, un seul toc suffit une fois frappé.
export const isQuickKnock = (knocked: boolean, level: ParanoiaLevel): boolean => knocked && level > 1
