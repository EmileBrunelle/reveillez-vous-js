export type Stoppable = { stop: () => void; complete?: () => void }

/** Mène des animations Motion à leur fin (puis les libère) : `stop()` seul les laisse figées à mi-course. */
export const finishAnimations = (list: Stoppable[]) => {
  list.forEach((a) => a.complete?.())
  list.forEach((a) => a.stop())
}
