// Logique pure du toucher sur l’éventail de la coupe (testée dans tests/components/deckTouch.test.ts).
// Au toucher, la carte visée est la plus proche du point de contact en X (les cartes inclinées se chevauchent : l’élément « du dessus » est trompeur).
export const DRAG_SLOP = 8 // px : en deçà, le contact est un tap ; au-delà, un glissement

export const nearestIndex = (px: number, centers: readonly number[]) => {
  let best = 0
  centers.forEach((c, i) => {
    if (Math.abs(px - c) < Math.abs(px - centers[best])) best = i
  })
  return best
}

// Premier tap sur un paquet = aperçu ; tap sur le paquet déjà en aperçu = choix.
export const tapOutcome = (hot: number | null, i: number): 'preview' | 'choose' => (hot === i ? 'choose' : 'preview')

export const isDrag = (dx: number, dy: number) => Math.hypot(dx, dy) > DRAG_SLOP
