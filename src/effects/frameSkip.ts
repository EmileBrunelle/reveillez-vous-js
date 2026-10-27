// Logique pure de saut de trame en mouvement réduit : le shader est alors statique, on ne redessine que si une entrée change.

/** Clé de l’image statique du CRT : seuls la taille du canvas et la paranoïa (à 3 décimales) la changent. */
export const crtStaticKey = (width: number, height: number, paranoia: number): string => `${width}x${height}|${paranoia.toFixed(3)}`

/** Clé de l’image statique d’un fond raymarché : taille, paranoïa et paramètres de la variante (voir `paramsKey`, hors `time`). */
export const raymarchStaticKey = (width: number, height: number, paranoia: number, variantKey: string): string => `${width}x${height}|${paranoia.toFixed(3)}|${variantKey}`

export type Vec4Fields = Record<string, number | number[]>

/** Champs d’uniforme du cristal : `p0`..`p{points-1}` (coups) et `g0`..`g{rows-1}` (grille), des vec4 initialisés à 0. */
export const makeVec4Fields = (base: Record<string, number>, points: number, rows: number): Vec4Fields => {
  const fields: Vec4Fields = { ...base }
  for (let i = 0; i < rows; i++) fields[`g${i}`] = [0, 0, 0, 0]
  for (let i = 0; i < points; i++) fields[`p${i}`] = [0, 0, 0, 0]
  return fields
}

/** Copie `src` (par paquets de 4, 0 si absent) dans les vec4 `${prefix}${i}` sans allouer ; renvoie vrai si une valeur a changé. */
export const copyVec4 = (fields: Vec4Fields, prefix: string, count: number, src: number[]): boolean => {
  let changed = false
  for (let i = 0; i < count; i++) {
    const v = fields[`${prefix}${i}`] as number[]
    for (let j = 0; j < 4; j++) {
      const n = src[i * 4 + j] ?? 0
      if (v[j] !== n) {
        v[j] = n
        changed = true
      }
    }
  }
  return changed
}

/**
 * Vrai si le cristal doit être redessiné hors des vec4 (dont `copyVec4` rend le changement) : première image,
 * taille du canvas, dissipation ou bascule de mouvement différentes de celles de la dernière image dessinée.
 */
export const crystalScalarsChanged = (last: { drawn: boolean; size: string; done: number; motion: number }, size: string, done: number, animated: boolean): boolean =>
  !last.drawn || last.size !== size || last.done !== done || last.motion !== (animated ? 1 : 0)
