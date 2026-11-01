// Éventail des trois cartes de la coupe : partagé entre DeckCut (placement) et TarotCard (point de départ de la donne).
// x/y en % de la largeur de la carte finale (centre de la boîte = 0,0), rot en degrés ; FAN_SCALE = largeur affichée d’une carte de l’éventail, en fraction de la boîte (la carte, large comme la boîte, est réduite à cette échelle puis grandit jusqu’à 1 au choix).
export const FAN_SCALE = 0.5
export const FAN = [
  { x: -17, y: 3, rot: -4 },
  { x: 0, y: -1, rot: 0 },
  { x: 17, y: 3, rot: 4 },
] as const

// Paquet et pile : « rien ne vient de nulle part pour aller nulle part ». Un vrai paquet (CardDeck : dos du dessus, tranche en couches, vu en perspective) est posé au centre de la boîte, derrière l’éventail.
// Les trois cartes de jeu sont les cartes du dessus : elles partent du dessus du paquet à la donne (étalées en éventail), y reviennent au choix (les deux non choisies, qui reculent et s’effacent), et la carte de lecture les y rejoint à sa sortie.
// Positions en fraction de la largeur W de la boîte (centre = 0,0 = centre du dessus du paquet), carte réduite à STOW_SCALE ; chaque carte i (0, 1, 2) a son léger décalage dans la pile (la carte du milieu, au sommet, est au centre).
export const STOW_SCALE = 0.3
export const STOW_END_SCALE = 0.25 // la pile recule encore un peu en s’effaçant
export const STOW_FADE_MS = 260 // la carte voyage d’abord jusqu’au paquet, puis recule et s’efface (jamais de fondu sec)
export const PILE_LIFE = 0.5 // part de l’oscillation et de l’inclinaison de l’éventail qu’une carte garde en pile : jamais d’immobilité totale
export const stowFrac = (i: number) => ({ x: (i - 1) * 0.02, y: (1 - i) * 0.012, r: (i - 1) * 4, s: STOW_SCALE })
export const stowOf = (i: number, w: number) => {
  const p = stowFrac(i)
  return { x: p.x * w, y: p.y * w, r: p.r, s: p.s }
}
/** Départ de la donne : les cartes ressortent exactement d’où elles se rangent, sur le dessus du paquet. */
export const dealStartOf = stowOf

// Paquet 3D (CardDeck) : inclinaison de repos (degrés, rotateX > 0 = le haut recule et la tranche descend ; rotateY < 0 = la tranche passe à droite), épaisseur en fraction de la largeur de la carte, nombre de couches de la tranche.
// Le dessus du paquet est le plan de pivot (z = 0) : le centre de la face visible ne bouge pas, la tranche pend dessous. Les cartes en pile prennent la même inclinaison (voir `deckPose`).
export const DECK_TILT = { x: 18, y: -10 } as const
export const DECK_THICK = 0.5
export const DECK_LAYERS = 12
export const FAN_PERSP = 1.3 // distance de la perspective, en largeurs de carte : cartes de l’éventail (inclinaison marquée)
export const DECK_PERSP = 4 // paquet et cartes qui y reposent : perspective plus douce, la tranche ne rétrécit pas sous la face du dessus
export const DECK_BREATH_HZ = 0.19 // respiration très lente (≤ 0,3 Hz) : déplacement et inclinaison seulement, jamais de luminance
export const DECK_BREATH_Y = 0.008 // amplitude verticale (fraction de W)
export const DECK_BREATH_TILT = 1.2 // degrés
export const DECK_POINTER_TILT = 7 // degrés d’inclinaison supplémentaire quand le pointeur est au bord de l’écran
/** Pose courante du paquet, écrite par CardDeck (seul maître de son transform) et lue par DeckCut pour que les cartes en pile reposent sur la face du dessus : degrés, et y en fraction de W. */
export const deckPose = { rx: DECK_TILT.x as number, ry: DECK_TILT.y as number, y: 0 }

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
