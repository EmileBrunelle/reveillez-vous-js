/** Décalage (px) entre le doigt et le point visé : le doigt ne cache plus la cible. */
export const TOUCH_LIFT = 40
/** Tolérance (ms) avant de considérer le doigt levé : lever puis reposer ne casse pas la prise. */
export const TOUCH_GRACE_MS = 300

/** Point visé dans la scène : au toucher, 40 px au-dessus du doigt ; à la souris ou au stylet, sous le curseur. */
export const aimPoint = (e: { clientX: number; clientY: number; pointerType: string }, rect: { left: number; top: number }): { x: number; y: number } => ({
  x: e.clientX - rect.left,
  y: e.clientY - rect.top - (e.pointerType === 'touch' ? TOUCH_LIFT : 0),
})
