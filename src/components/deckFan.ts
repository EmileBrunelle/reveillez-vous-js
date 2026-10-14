// Éventail des trois cartes de la coupe : partagé entre DeckCut (placement) et TarotCard (point de départ de la donne).
// x/y en % de la largeur de la carte finale (centre de la boîte = 0,0), rot en degrés ; FAN_SCALE = largeur relative d’une carte de l’éventail.
export const FAN_SCALE = 0.55
export const FAN = [
  { x: -17, y: 3, rot: -7 },
  { x: 0, y: -1, rot: 0 },
  { x: 17, y: 3, rot: 7 },
] as const
