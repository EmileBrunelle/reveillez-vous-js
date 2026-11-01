// Éventail des trois cartes de la coupe : partagé entre DeckCut (placement) et TarotCard (point de départ de la donne).
// x/y en % de la largeur de la carte finale (centre de la boîte = 0,0), rot en degrés ; FAN_SCALE = largeur affichée d’une carte de l’éventail, en fraction de la boîte (la carte, large comme la boîte, est réduite à cette échelle puis grandit jusqu’à 1 au choix).
export const FAN_SCALE = 0.5
export const FAN = [
  { x: -17, y: 3, rot: -4 },
  { x: 0, y: -1, rot: 0 },
  { x: 17, y: 3, rot: 4 },
] as const

// Pile de rangement : « rien ne vient de nulle part pour aller nulle part ». Un petit paquet de dos de cartes, statique, est posé au centre de la boîte, derrière l’éventail.
// Les cartes en sortent en s’étalant à la donne, y retournent en se rassemblant au choix (les deux non choisies), et la carte de lecture les y rejoint à sa sortie.
// Positions en fraction de la largeur W de la boîte (centre = 0,0), carte réduite à STOW_SCALE ; chaque carte i (0, 1, 2) a son léger décalage dans la pile.
export const STOW_SCALE = 0.3
export const STOW_FADE_MS = 260 // la carte voyage d’abord, puis s’efface une fois sur la pile (jamais de fondu sec)
export const stowFrac = (i: number) => ({ x: (i - 1) * 0.012, y: (1 - i) * 0.008, r: (i - 1) * 3, s: STOW_SCALE })
export const stowOf = (i: number, w: number) => {
  const p = stowFrac(i)
  return { x: p.x * w, y: p.y * w, r: p.r, s: p.s }
}

// Départ échelonné des cartes non choisies (ms après le choix) : la plus proche du choix part d’abord, le milieu un demi-pas plus tard.
export const STOW_STEP_MS = 70
export const stowDelay = (i: number, chosen: number, base: number) => base + ((i < chosen ? 0 : 1) + (i === 1 ? 0.5 : 0)) * STOW_STEP_MS

// Ordre d’empilement : deux cartes ne changent d’ordre que lorsque leurs surfaces ne se recouvrent plus du tout (jamais en plein chevauchement).
// La carte choisie sort donc d’abord du paquet sur le côté ; dès que son rectangle est séparé de celui de chaque carte encore visible, elle passe devant, puis vole.
export const EXIT_SHIFT = 0.42 // écart latéral de sortie de la carte choisie (fraction de W) : assez pour dégager la carte du milieu
export interface CardBox {
  x: number // centre, px
  y: number
  s: number // échelle : largeur de la carte = s × w
  r: number // rotation, degrés
}
/** Boîte englobante (alignée sur les axes) d’une carte tournée, élargie de `pad` px (couvre l’inclinaison 3D et le retard d’une image) ; `w` = largeur de la boîte de la carte (échelle 1), hauteur = 12/7 de la largeur. */
export const cardRect = (b: CardBox, w: number, pad = 0) => {
  const hw = (b.s * w) / 2
  const hh = (b.s * w * 12) / 7 / 2
  const a = (b.r * Math.PI) / 180
  const ex = Math.abs(Math.cos(a)) * hw + Math.abs(Math.sin(a)) * hh
  const ey = Math.abs(Math.sin(a)) * hw + Math.abs(Math.cos(a)) * hh
  return { l: b.x - ex - pad, r: b.x + ex + pad, t: b.y - ey - pad, b: b.y + ey + pad }
}
export const rectsOverlap = (a: ReturnType<typeof cardRect>, b: ReturnType<typeof cardRect>) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

// Profondeur logique d’une carte (0 = rangée, 1 = carte du tirage) : c’est son échelle, la même valeur qui décide de l’ombre.
export const depthOf = (s: number, finalS = 1) => Math.max(0, Math.min(1, (s - STOW_SCALE) / (finalS - STOW_SCALE)))
// Ombre portée froide pré-floutée : plus la carte est haute, plus l’ombre est décalée (px, dans le repère de la carte), large et pâle ; une carte basse a une ombre courte et plus sombre.
export const shadowOf = (depth: number, w: number) => ({ y: (0.012 + 0.05 * depth) * w, s: 1 + 0.07 * depth, o: 0.6 - 0.32 * depth })

/** Borne le décalage x (px, depuis le centre de la boîte) d’une carte de demi-largeur `hw` pour qu’elle reste entière dans le viewport ; `cx` = centre de la boîte à l’écran, `vw` = largeur du viewport, `m` = marge. */
export const clampExitX = (x: number, cx: number, vw: number, hw: number, m: number) => {
  const lo = hw + m - cx
  const hi = vw - hw - m - cx
  return lo > hi ? 0 : Math.max(lo, Math.min(hi, x))
}
