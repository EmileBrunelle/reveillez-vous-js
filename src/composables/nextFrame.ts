import { useRafFn } from '@vueuse/core'

/** Se résout à la prochaine image (rAF) : attend qu’un canevas fraîchement monté soit mis en page. `once` : la boucle s’arrête d’elle-même après un tour. */
export const nextFrame = () =>
  new Promise<void>((resolve) => {
    useRafFn(() => resolve(), { once: true })
  })
