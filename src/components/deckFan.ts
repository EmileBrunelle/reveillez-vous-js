// Éventail des trois cartes de la coupe : partagé entre DeckCut (placement) et TarotCard (point de départ de la donne).
// x/y en % de la largeur de la carte finale (centre de la boîte = 0,0), rot en degrés ; FAN_SCALE = largeur affichée d’une carte de l’éventail, en fraction de la boîte (la carte, large comme la boîte, est réduite à cette échelle puis grandit jusqu’à 1 au choix).
export const FAN_SCALE = 0.62
export const FAN = [
  { x: -14, y: 3, rot: -6.5 },
  { x: 0, y: -1, rot: 0 },
  { x: 14, y: 3, rot: 6.5 },
] as const
