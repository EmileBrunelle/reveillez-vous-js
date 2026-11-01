/**
 * Éclairage et matière de chaque porte : lus par `DoorShading` (relief et reflets, dans un filtre SVG statique) et par `DoorGround`
 * (ombre au sol et brume). Tout est calculé une fois à la peinture : aucun coût par image tant que la porte ne change pas de contenu.
 */
/** Mécanisme d’une poignée : `knob` (bouton rond) tourne sur lui-même, `lever` (loquet, béquille) pivote vers le bas autour de son axe, `bar` (barre de tirage) reste fixe. */
export type HandleKind = 'knob' | 'lever' | 'bar'

export interface DoorLook {
  /** Azimut de la lumière dans le plan de l’écran (degrés, sens horaire, y vers le bas) : 315 = en haut à droite (lune), 225 = en haut à gauche. */
  azimuth: number
  /** Teinte multipliée sur la porte (lumière ambiante du lieu). */
  tint: string
  /** Couleur des reflets sur les arêtes et la quincaillerie. */
  rim: string
  /** Gain global : < 1 assombrit la porte pour qu’elle tienne dans la nuit du fond. */
  gain: number
  /** Matière : grain fractal ajouté au relief (`freq` = baseFrequency x y en px CSS, `amp` = hauteur ajoutée). */
  grain: { freq: string; amp: number; octaves: number }
  /** Intensité du biseau des arêtes et des panneaux. */
  relief: number
  /** Couleur de la brume au pied de la porte (assortie au fond du lieu). */
  fog: string
  /** Côté où tombe l’ombre portée au sol : -1 = à gauche, 1 = à droite (à l’opposé de la lumière). */
  cast: -1 | 1
  /** Opacité de l’ombre de contact (0 pour une porte qui flotte). */
  contact: number
  /** Couleur du chant (la tranche du battant, visible quand il vient vers nous : coup de la voyante, claquement). */
  edge: string
  /** Poignées dans l’ordre des éléments `.door-handle` du SVG de la porte : chacune bouge selon son vrai mécanisme. */
  handles: HandleKind[]
  /** Tirage du battant à l’ouverture, en px (translation vers nous avant le pivot : joint magnétique qui lâche) ; 0 pour une porte ordinaire. */
  tug: number
  /** Emprise réelle du battant dans la boîte 120 × 190 (unités du viewBox, identiques à celles des masques) : gonds à gauche, chant du côté serrure,
   *  `top` et `bottom` bornent le tronçon droit du chant (le sommet d’une arche ou d’un fronton n’en fait pas partie). */
  bounds: LeafBounds
  /** Porte à deux battants (garde-robe) : gauche puis droit, chacun avec ses gonds sur son bord extérieur et son chant au centre.
   *  Le SVG est découpé en deux moitiés (même dessin rendu deux fois, `clip-path`) ; les battants pivotent en miroir. Absent = un seul battant (`bounds`). */
  leaves?: readonly [LeafBounds, LeafBounds]
}

/** Emprise d’un battant dans la boîte 120 × 190 : `hingeX` = côté des gonds, `edgeX` = chant (au centre pour une porte double). */
export interface LeafBounds {
  hingeX: number
  edgeX: number
  top: number
  bottom: number
}

const MOON = { tint: '#c4d0f0', rim: '#e4ecff', fog: '#7686a6' }

export const doorLooks: Record<string, DoorLook> = {
  perron: {
    ...MOON,
    azimuth: 315,
    gain: 0.95,
    grain: { freq: '0.5 0.02', amp: 0.18, octaves: 2 },
    relief: 1,
    cast: -1,
    contact: 0.75,
    edge: '#3d0f0c',
    handles: ['knob', 'bar'],
    tug: 0,
    bounds: { hingeX: 2.5, edgeX: 117.5, top: 2.5, bottom: 190 },
  },
  cabane: {
    ...MOON,
    tint: '#bcc8d4',
    fog: '#667c78',
    azimuth: 315,
    gain: 0.85,
    grain: { freq: '0.3 0.012', amp: 0.55, octaves: 3 },
    relief: 1.1,
    cast: -1,
    contact: 0.8,
    edge: '#1c1209',
    handles: ['lever'],
    tug: 0,
    bounds: { hingeX: 1.5, edgeX: 118.5, top: 1.5, bottom: 190 },
  },
  mausolee: {
    ...MOON,
    azimuth: 315,
    gain: 1.05,
    grain: { freq: '0.9 0.7', amp: 0.45, octaves: 3 },
    relief: 1.3,
    cast: -1,
    contact: 0.8,
    edge: '#14161a',
    handles: ['knob', 'knob'],
    tug: 0,
    bounds: { hingeX: 14, edgeX: 106, top: 92, bottom: 190 },
  },
  maison: {
    tint: '#ffe0b4',
    rim: '#ffe6bd',
    fog: '#a8987a',
    azimuth: 225,
    gain: 0.82,
    grain: { freq: '0.6 0.03', amp: 0.16, octaves: 2 },
    relief: 1,
    cast: 1,
    contact: 0.75,
    edge: '#14281f',
    handles: ['knob'],
    tug: 0,
    bounds: { hingeX: 10, edgeX: 110, top: 72, bottom: 190 },
  },
  nuages: {
    ...MOON,
    tint: '#c8cff2',
    fog: '#aab0d8',
    azimuth: 225,
    gain: 0.95,
    grain: { freq: '0.04 0.04', amp: 0.2, octaves: 2 },
    relief: 1,
    cast: 1,
    contact: 0.25,
    edge: '#161434',
    handles: ['knob'],
    tug: 0,
    bounds: { hingeX: 21, edgeX: 99, top: 21, bottom: 169 },
  },
  'garde-robe': {
    ...MOON,
    tint: '#cdd2d8',
    azimuth: 270,
    gain: 0.78,
    grain: { freq: '0.4 0.015', amp: 0.35, octaves: 3 },
    relief: 1,
    cast: 1,
    contact: 0.7,
    edge: '#7a6a45',
    handles: ['knob', 'knob'],
    tug: 0,
    bounds: { hingeX: 4, edgeX: 116, top: 4, bottom: 190 },
    // Deux battants qui se rejoignent à la fente centrale (x = 60) : gonds à gauche et à droite.
    leaves: [
      { hingeX: 4, edgeX: 60, top: 4, bottom: 190 },
      { hingeX: 116, edgeX: 60, top: 4, bottom: 190 },
    ],
  },
  frigo: {
    ...MOON,
    tint: '#d0e0e8',
    azimuth: 300,
    gain: 0.85,
    grain: { freq: '0.8 0.8', amp: 0.06, octaves: 1 },
    relief: 0.9,
    cast: -1,
    contact: 0.7,
    edge: '#7a9a9a',
    handles: ['bar', 'bar'],
    tug: 10,
    bounds: { hingeX: 4, edgeX: 116, top: 16, bottom: 190 },
  },
}

export const lookFor = (id: string): DoorLook => doorLooks[id] ?? doorLooks.perron
