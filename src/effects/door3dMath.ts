// Logique pure de la porte 3D (sans GPU) : préréglages par lieu, uniformes, ressort du cognement.
import type { PlaceId } from './places/types'

type Rgb = readonly [number, number, number]

/** Lumière du lieu : direction VERS la lumière (repère de la porte : x à droite, y en haut, z vers l’intérieur), couleur, ambiance. */
export interface Door3dLight {
  dir: readonly [number, number, number]
  color: Rgb
  ambient: Rgb
}

/** Matériau et style d’une porte de lieu, d’après les SVG de `src/assets/svg/porte-*.svg`. */
export interface Door3dLook {
  /** Battant (bois ou fer). */
  wood: Rgb
  /** Panneaux (style 0). */
  panel: Rgb
  /** Chambranle, linteau ; le seuil et l’embrasure en sont une teinte plus sombre. */
  frame: Rgb
  /** Poignée, heurtoir, charnières, pentures. */
  metal: Rgb
  /** 0 = panneaux, 1 = planches, 2 = fer riveté. */
  style: 0 | 1 | 2
  cols: number
  rows: number
  /** 0..1 : battant métallique. */
  shine: number
  /** Étoile dorée incrustée à la place du heurtoir (nuages). */
  emblem?: boolean
  /** Encadrement : 0 = chambranle, 1 = imposte en éventail (rue), 2 = mausolée en plein cintre, 3 = contre-porte vitrée (perron), 4 = flottant (nuages). */
  trim: 0 | 1 | 2 | 3 | 4
  /** Hauteur de l’ouverture (m) : 1,70 sous le linteau, moins sous l’imposte de la rue ou au sommet de l’arche du mausolée. */
  opening: number
}

export interface Door3dPreset {
  look: Door3dLook
  light: Door3dLight
}

/** `#rrggbb` → rouge, vert, bleu linéaires (0..1) : le shader éclaire en linéaire, le canevas affiche en sRGB. */
export const hexLinear = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)]
}

const norm = (x: number, y: number, z: number): [number, number, number] => {
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}

/**
 * Une porte par lieu. Couleurs reprises des SVG ; lumières inspirées des fonds raymarchés (`effects/places/*.wgsl`) :
 * lune froide en hauteur (perron, forêt, cimetière, nuages), lampadaire au sodium chaud et bas pour la rue.
 * La lumière vient de devant (z négatif, côté caméra) pour que la face de la porte soit éclairée.
 */
export const DOOR3D_PRESETS: Record<PlaceId, Door3dPreset> = {
  perron: {
    look: { wood: hexLinear('#6e1f1a'), panel: hexLinear('#7d2a22'), frame: hexLinear('#e8dcc0'), metal: hexLinear('#c9a24a'), style: 0, cols: 2, rows: 3, shine: 0.15, trim: 3, opening: 1.7 },
    light: { dir: norm(-0.55, 0.6, -0.6), color: [1.25, 1.2, 1.05], ambient: [0.05, 0.055, 0.08] },
  },
  foret: {
    look: { wood: hexLinear('#6a4a2a'), panel: hexLinear('#6a4a2a'), frame: hexLinear('#4a3320'), metal: hexLinear('#2a2a2a'), style: 1, cols: 1, rows: 1, shine: 0, trim: 0, opening: 1.7 },
    light: { dir: norm(-0.35, 0.75, -0.55), color: [0.95, 1.0, 1.15], ambient: [0.035, 0.045, 0.05] },
  },
  cimetiere: {
    look: { wood: hexLinear('#3a3c44'), panel: hexLinear('#26282e'), frame: hexLinear('#9a9ca6'), metal: hexLinear('#6a6c76'), style: 2, cols: 2, rows: 2, shine: 0.8, trim: 2, opening: 1.42 },
    light: { dir: norm(0.45, 0.7, -0.55), color: [0.95, 1.02, 1.2], ambient: [0.04, 0.045, 0.06] },
  },
  rue: {
    look: { wood: hexLinear('#2f5a4a'), panel: hexLinear('#3a6a58'), frame: hexLinear('#d9ceb4'), metal: hexLinear('#c9a24a'), style: 0, cols: 2, rows: 2, shine: 0.2, trim: 1, opening: 1.13 },
    light: { dir: norm(0.7, 0.35, -0.62), color: [1.5, 0.98, 0.5], ambient: [0.05, 0.04, 0.045] },
  },
  nuages: {
    look: {
      wood: hexLinear('#2a2748'),
      panel: hexLinear('#36335e'),
      frame: hexLinear('#d8dcf0'),
      metal: hexLinear('#e8e0b0'),
      style: 0,
      cols: 2,
      rows: 3,
      shine: 0.3,
      emblem: true,
      trim: 4,
      opening: 1.7,
    },
    light: { dir: norm(-0.2, 0.8, -0.55), color: [1.05, 1.1, 1.35], ambient: [0.07, 0.07, 0.11] },
  },
}

/** Ouverture maximale admise (degrés) : au-delà, le battant sortirait de la boîte englobante du shader. */
export const MAX_ANGLE_DEG = 82

export interface Door3dInput {
  /** Degrés, 0 = fermée ; borné à [-6, MAX_ANGLE_DEG] (un peu de négatif pour le sursaut du cognement). */
  angleDeg: number
  /** Déplacement du ressort du cognement, en degrés (s’ajoute à l’angle). */
  knockDeg: number
  /** Inclinaison au survol ou au focus clavier, en degrés (négatif = le battant vient vers nous) ; s’ajoute à l’angle, jamais maître du pivot. */
  leanDeg?: number
  width: number
  height: number
  shadows: boolean
  look: Door3dLook
  light: Door3dLight
  /** 0..1 : opacité de l’intérieur chaud. */
  interior: number
  mist: number
}

/** Valeurs de l’uniforme `Params` de `door3d.wgsl` (noms = champs de la struct). */
export const door3dParams = (i: Door3dInput): Record<string, number> => {
  const deg = Math.min(MAX_ANGLE_DEG, Math.max(-6, i.angleDeg + i.knockDeg + (i.leanDeg ?? 0)))
  const { look, light } = i
  return {
    width: i.width,
    height: i.height,
    angle: (deg * Math.PI) / 180,
    shadows: i.shadows ? 1 : 0,
    lx: light.dir[0],
    ly: light.dir[1],
    lz: light.dir[2],
    lr: light.color[0],
    lg: light.color[1],
    lb: light.color[2],
    ar: light.ambient[0],
    ag: light.ambient[1],
    ab: light.ambient[2],
    wr: look.wood[0],
    wg: look.wood[1],
    wb: look.wood[2],
    pr: look.panel[0],
    pg: look.panel[1],
    pb: look.panel[2],
    fr: look.frame[0],
    fg: look.frame[1],
    fb: look.frame[2],
    mr: look.metal[0],
    mg: look.metal[1],
    mb: look.metal[2],
    style: look.style,
    cols: look.cols,
    rows: look.rows,
    shine: look.shine,
    interior: Math.min(1, Math.max(0, i.interior)),
    mist: Math.min(1, Math.max(0, i.mist)),
    emblem: look.emblem ? 1 : 0,
    kind: look.trim,
    oh: look.opening,
  }
}

/**
 * Ressort amorti du cognement (masse 1) : raideur 300, amortissement 10 → ~2,8 Hz, sous le seuil de 3 Hz (WCAG 2.3.1), amorti en ~0,6 s.
 * Un coup donne une vitesse vers la caméra (angle négatif), comme le sursaut CSS de DoorScene.
 */
export const KNOCK_STIFFNESS = 300
export const KNOCK_DAMPING = 10
/** Sous ces seuils (degrés, degrés/s), le ressort est au repos : la boucle peut s’arrêter. */
const REST_X = 0.01
const REST_V = 0.05

export interface KnockSpring {
  /** Déplacement courant (degrés). */
  readonly x: number
  readonly active: boolean
  /** Coup d’intensité 0..1. */
  kick: (intensity: number) => void
  /** Avance de `dt` secondes (sous-pas fixes, stable quel que soit le débit) ; renvoie `active`. */
  step: (dt: number) => boolean
  reset: () => void
}

export const createKnockSpring = (): KnockSpring => {
  let x = 0
  let v = 0
  let active = false
  return {
    get x() {
      return x
    },
    get active() {
      return active
    },
    kick: (intensity) => {
      const k = Math.min(1, Math.max(0, intensity))
      v -= 60 + 110 * k // ~ -1,5° à -4° de crête, comme `jitterInside`
      active = true
    },
    step: (dt) => {
      if (!active) return false
      let left = Math.min(Math.max(dt, 0), 0.1)
      while (left > 1e-6) {
        const h = Math.min(left, 1 / 240)
        v += (-KNOCK_STIFFNESS * x - KNOCK_DAMPING * v) * h
        x += v * h
        left -= h
      }
      if (Math.abs(x) < REST_X && Math.abs(v) < REST_V) {
        x = 0
        v = 0
        active = false
      }
      return active
    },
    reset: () => {
      x = 0
      v = 0
      active = false
    },
  }
}

// Repère de la boîte du canevas : 1,2 m × 1,9 m (voir `door3d.wgsl`), le sol à 2,1 cm sous le bas de la boîte.
const BOX_W = 1.2
const BOX_H = 1.9
const OPEN_HALF = 0.45
const FLOOR_OFFSET = 0.021
const pct = (n: number) => `${(n * 100).toFixed(2)}%`
/** Hauteur monde (m) → fraction depuis le haut de la boîte. */
const fromTop = (y: number) => (BOX_H - y - FLOOR_OFFSET) / BOX_H

/**
 * Ouverture de la porte (là où se voit ce qui est derrière : lueur intérieure, voyante) en pourcentages de la boîte, `inset` CSS prêt à
 * l’emploi. Sous l’arche du mausolée, le haut de l’ouverture est un demi-cercle (`radius`).
 */
export const door3dOpening = (look: Door3dLook): { inset: string; radius: string; left: number; right: number; bottom: number } => {
  const left = (BOX_W / 2 - OPEN_HALF) / BOX_W
  const top = fromTop(look.opening)
  const bottom = FLOOR_OFFSET / BOX_H
  const arch = look.trim === 2
  return {
    inset: `${pct(top)} ${pct(left)} ${pct(bottom)} ${pct(left)}`,
    radius: arch ? `${pct(0.5)} ${pct(0.5)} 0 0 / ${pct(OPEN_HALF / (BOX_H * (1 - top - bottom)))} ${pct(OPEN_HALF / (BOX_H * (1 - top - bottom)))} 0 0` : '0',
    // Bornes dans la boîte 120 × 190 (même unité que `DoorLook.bounds`), pour la lueur au sol.
    left: left * 120,
    right: (1 - left) * 120,
    bottom: (1 - bottom) * 190,
  }
}

/**
 * Silhouette approchée du cadre (chambranle et linteau, ou massif du mausolée) pour la lueur du survol et l’anneau du focus :
 * un rectangle dont seul le débord se voit (`box-shadow`), l’ouverture reste libre. Pourcentages de la boîte.
 */
export const door3dSilhouette = (look: Door3dLook): { inset: string } => {
  const half = look.trim === 2 ? 0.6 : 0.58
  const side = (BOX_W / 2 - half) / BOX_W
  const top = look.trim === 2 ? fromTop(1.72) : fromTop(1.7 + 0.13)
  return { inset: `${pct(Math.max(0, top))} ${pct(side)} 0 ${pct(side)}` }
}
