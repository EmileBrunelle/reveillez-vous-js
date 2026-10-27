// Logique pure du toucher sur l’éventail de la coupe (testée dans tests/components/deckTouch.test.ts).
export const DRAG_SLOP = 8 // px : en deçà, le contact est un tap ; au-delà, un glissement

export const isDrag = (dx: number, dy: number) => Math.hypot(dx, dy) > DRAG_SLOP
