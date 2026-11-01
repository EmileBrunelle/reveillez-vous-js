// Remise d’une carte dans le paquet (sortie de la lecture) : « une vraie carte qu’on glisse dans le jeu », à une hauteur tirée au hasard.
// Logique pure (positions, rang, durées) ; TarotCard (la carte) et CardDeck (le paquet et sa couche de recouvrement) la lisent toutes deux, pour que leurs minuteries concordent.
//
// Déroulement (ms depuis le début de la sortie) :
//   1. approche : la carte recule (échelle et inclinaison du paquet) et se place À CÔTÉ du paquet, à la hauteur de la tranche visée, sans le chevaucher ;
//   2. séparée, elle prend le niveau d’insertion : la couche de recouvrement (copie fixe du dessus du paquet, des couches au-dessus du rang visé) s’allume PAR-DESSUS elle
//      au moment où les deux surfaces ne se touchent pas : l’ordre ne change donc jamais pendant un chevauchement, et il n’y a aucun z-index animé ;
//   3. glissement : seul son `translate` bouge ; la partie déjà entrée est cachée par la couche de recouvrement ;
//   4. fonte : rentrée, elle se fond dans la tranche ; la couche s’éteint (le paquet dessous est identique), puis le paquet recule et s’efface.
import { DECK_LAYERS, DECK_PERSP, DECK_THICK, STOW_END_SCALE, STOW_SCALE } from './deckFan'

export const INSERT_MS = { approach: 220, slide: 200, melt: 90, settle: 30, vanish: 140 } as const
/** Fin du trajet de la carte (ms) : la couche de recouvrement reste allumée jusqu’à `coverOffMs`, une petite marge après, pour que la carte soit déjà invisible dessous. */
export const INSERT_CARD_MS = INSERT_MS.approach + INSERT_MS.slide + INSERT_MS.melt
export const INSERT_COVER_OFF_MS = INSERT_CARD_MS + INSERT_MS.settle
export const INSERT_TOTAL_MS = INSERT_COVER_OFF_MS + INSERT_MS.vanish
export const INSERT_FADE_IN_MS = 140 // le paquet apparaît derrière la carte, qui le couvre encore
export const INSERT_SIDE_GAP = 0.12 // écart entre la carte et le paquet à côté de lui, en largeurs de carte rangée
export const INSERT_END_SCALE = STOW_END_SCALE + 0.01 // le paquet recule un peu en s’effaçant

/** Rang visé, tiré de `rand` ∈ [0, 1[ (`Math.random` suffit : purement cosmétique) : 0 = juste sous le dos du dessus, DECK_LAYERS − 1 = juste au-dessus de la dernière couche. */
export const pickSlot = (rand: number, layers = DECK_LAYERS) => Math.min(layers - 1, Math.max(0, Math.floor(rand * layers)))
/** Rang du paquet courant, écrit une fois par CardDeck (seul maître) et lu par TarotCard : la carte et la couche de recouvrement visent la même tranche. */
export const deckSlot = { value: 0 }

/** Profondeur (en largeurs de carte) du plan de la carte insérée au rang `slot` : à mi-chemin entre la couche au-dessus (ou le dos du dessus) et la couche en dessous. */
export const slotDepth = (slot: number, layers = DECK_LAYERS, thick = DECK_THICK) => ((slot + 0.5) * thick) / layers

/** Projette le point (0, 0, −depth) du paquet (même ordre que CardDeck : perspective, rotateX, rotateY) : décalage à l’écran en largeurs de carte, et facteur d’échelle de la perspective. */
export const projectDepth = (depth: number, rxDeg: number, ryDeg: number, persp = DECK_PERSP) => {
  const a = (rxDeg * Math.PI) / 180
  const b = (ryDeg * Math.PI) / 180
  const z1 = -depth * Math.cos(b) // après rotateY ; x1 = −depth·sin(b)
  const x = -depth * Math.sin(b)
  const y = -z1 * Math.sin(a) // après rotateX
  const z = z1 * Math.cos(a)
  const k = 1 / (1 - z / persp)
  return { x: x * k, y: y * k, s: k }
}

export interface InsertPose {
  x: number // centre de la carte, px depuis le centre de la boîte
  y: number
  s: number // échelle
  rx: number // inclinaison (degrés) : celle du paquet
  ry: number
}
/** Poses de la carte (px, repère de la boîte, `w` = sa largeur) : `side` à côté du paquet, au niveau du rang `slot` ; `inside` entièrement rentrée. `pose` = pose courante du paquet (deckPose : y en fraction de w). */
export const insertPoses = (slot: number, pose: { rx: number; ry: number; y: number }, w: number): { side: InsertPose; inside: InsertPose } => {
  const p = projectDepth(slotDepth(slot), pose.rx, pose.ry)
  const inside = { x: STOW_SCALE * p.x * w, y: (pose.y + STOW_SCALE * p.y) * w, s: STOW_SCALE * p.s, rx: pose.rx, ry: pose.ry }
  return { side: { ...inside, x: inside.x + (1 + INSERT_SIDE_GAP) * STOW_SCALE * w }, inside }
}
