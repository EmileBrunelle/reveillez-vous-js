import { useRafFn, useTimeoutFn } from '@vueuse/core'

/** Se résout à la prochaine image (rAF) : attend qu’un canevas fraîchement monté soit mis en page. `once` : la boucle s’arrête d’elle-même après un tour. */
export const nextFrame = () =>
  new Promise<void>((resolve) => {
    useRafFn(() => resolve(), { once: true })
  })

/**
 * Prochaine image OU `ms` millisecondes, selon le premier des deux (l’onglet masqué suspend rAF) ; le perdant est arrêté tout de suite :
 * ni minuterie qui traîne, ni boucle rAF vivante.
 */
export const nextFrameOr = (ms: number) =>
  new Promise<void>((resolve) => {
    const done = () => {
      raf.pause()
      timer.stop()
      resolve()
    }
    const raf = useRafFn(done, { once: true })
    const timer = useTimeoutFn(done, ms)
  })
