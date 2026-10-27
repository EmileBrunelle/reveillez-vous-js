import { useRafFn } from '@vueuse/core'

/** Se résout à la prochaine image (rAF) : attend qu’un canevas fraîchement monté soit mis en page. La boucle s’arrête d’elle-même après un tour. */
export const nextFrame = () =>
  new Promise<void>((resolve) => {
    const { pause } = useRafFn(() => {
      pause()
      resolve()
    })
  })
