/** Aides pures de la boule de cristal : anneau de coups de chiffon et estimation de couverture. Coordonnées : disque unité, y vers le bas. */

/** Part de la boule à essuyer pour réussir. */
export const WIN_RATIO = 0.7
/** Rayon d’essuyage d’un point (disque unité) : un trou apparaît entre deux points plus éloignés que lui. */
export const WIPE_RADIUS = 0.22
/**
 * Pas d’une pression de flèche (disque unité), borné par WIPE_RADIUS pour que l’essuyage au clavier ne laisse pas de trous.
 * Le nombre de pressions pour réussir en serpentin est vérifié par tests/effects/crystalMath.test.ts.
 */
export const KEY_STEP = 0.2

/** Nombre de points transmis au shader (champs p0..p7 de l’uniforme). */
export const RING_SIZE = 8

export interface Stamp {
  x: number
  y: number
  /** Secondes (horloge de l’appelant). */
  t: number
}

/** Anneau de taille fixe : le plus ancien point est écrasé. `pack` produit [x, y, âge, poids] par point (8 × 4 valeurs). */
export const createWipeRing = (size = RING_SIZE) => {
  const stamps: (Stamp | null)[] = Array.from({ length: size }, () => null)
  let head = 0
  // Poids selon le rang (0 = le plus récent) : les derniers points de l’anneau s’estompent avant d’être écrasés, sans retour brusque de la brume.
  const rankWeight = (rank: number) => Math.min(1, Math.max(0, (size - 1 - rank) / (size * 0.4)))
  return {
    add: (x: number, y: number, t: number) => {
      stamps[head] = { x, y, t }
      head = (head + 1) % size
    },
    clear: () => {
      stamps.fill(null)
      head = 0
    },
    pack: (now: number): number[] => stamps.flatMap((s, i) => (s ? [s.x, s.y, Math.max(0, now - s.t), rankWeight((head - 1 - i + size) % size)] : [0, 0, 0, 0])),
    /** Points actifs, du plus ancien au plus récent. */
    active: (): Stamp[] => [...stamps.slice(head), ...stamps.slice(0, head)].filter((s) => s !== null),
  }
}

/** Points espacés d’au plus `spacing` entre `a` (exclu) et `b` (inclus), pour qu’un glissé rapide ne laisse pas de trous. */
export const stampsAlong = (a: { x: number; y: number }, b: { x: number; y: number }, spacing: number): { x: number; y: number }[] => {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const n = Math.max(1, Math.ceil(dist / spacing))
  return Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * (i + 1)) / n, y: a.y + ((b.y - a.y) * (i + 1)) / n }))
}

/**
 * Points à poser en allant de `last` (dernier point posé, ou null) vers `to` : un point tous les `spacing` exactement,
 * rien si on n’a pas assez bougé (le reste est reporté : `last` ne change pas). Renvoie aussi le nouveau `last`.
 */
export const spacedStamps = (last: { x: number; y: number } | null, to: { x: number; y: number }, spacing: number): { points: { x: number; y: number }[]; last: { x: number; y: number } } => {
  if (!last) return { points: [to], last: to }
  const dist = Math.hypot(to.x - last.x, to.y - last.y)
  const n = Math.floor(dist / spacing)
  const points = Array.from({ length: n }, (_, i) => ({ x: last.x + ((to.x - last.x) * (i + 1) * spacing) / dist, y: last.y + ((to.y - last.y) * (i + 1) * spacing) / dist }))
  return { points, last: points.at(-1) ?? last }
}

/** Ramène un point dans le disque unité. */
export const clampToDisc = (x: number, y: number): { x: number; y: number } => {
  const r = Math.hypot(x, y)
  return r > 1 ? { x: x / r, y: y / r } : { x, y }
}

/** Une rangée = n bits dans un entier (bit i = colonne i) : exact en f32 jusqu’à n = 24. Renvoie n valeurs, rangée j en position j. */
export const packCoverage = (wiped: boolean[], n = 16): number[] =>
  Array.from({ length: n }, (_, j) => {
    let row = 0
    for (let i = 0; i < n; i++) if (wiped[j * n + i]) row += 2 ** i
    return row
  })

/** Lit la cellule (i, j) d’une grille emballée ; miroir exact de `cell` dans crystal.wgsl (en f32). */
export const decodeCell = (packed: number[], i: number, j: number, n = 16): boolean => {
  if (i < 0 || j < 0 || i >= n || j >= n) return false
  const r = Math.floor(Math.fround(packed[j]!) + 0.5)
  return ((r >> i) & 1) === 1
}

/** Grille grossière n × n : seules les cellules dont le centre est dans le disque comptent. */
export const createCoverage = (n = 16, radius = WIPE_RADIUS) => {
  const inside: boolean[] = []
  const wiped: boolean[] = []
  let total = 0
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const cx = ((i + 0.5) / n) * 2 - 1
      const cy = ((j + 0.5) / n) * 2 - 1
      const ok = Math.hypot(cx, cy) <= 1
      inside.push(ok)
      wiped.push(false)
      if (ok) total++
    }
  let count = 0
  return {
    total,
    mark: (x: number, y: number) => {
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const k = j * n + i
          if (!inside[k] || wiped[k]) continue
          const cx = ((i + 0.5) / n) * 2 - 1
          const cy = ((j + 0.5) / n) * 2 - 1
          if (Math.hypot(cx - x, cy - y) <= radius) {
            wiped[k] = true
            count++
          }
        }
    },
    ratio: () => (total ? count / total : 0),
    /** Grille emballée pour le shader (16 rangées de 16 bits). */
    pack: () => packCoverage(wiped, n),
  }
}
