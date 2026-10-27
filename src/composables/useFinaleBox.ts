import type { Ref } from 'vue'
import { animate, useMotionValue } from 'motion-v'
import { useResizeObserver } from '@vueuse/core'
import type { Stoppable } from './finishAnimations'

/**
 * Conteneur du texte puis du générique : il entre sur un ressort (échelle + opacité) et sa hauteur suit celle du contenu `inner` au ressort,
 * au lieu d’apparaître d’un coup plus grand. Mouvement réduit : simple fondu, hauteur posée directement. Renvoie les valeurs Motion à lier au
 * gabarit (`:style` d’un `<Motion>`) : aucune écriture à la main sur l’élément. `keep` retient les animations (voir useKeptAnimations).
 */
export const useFinaleBox = (inner: Readonly<Ref<HTMLElement | null>>, flags: { reduced: Readonly<Ref<boolean>>; skipped: Readonly<Ref<boolean>> }, keep: (a: Stoppable) => void) => {
  const { reduced, skipped } = flags
  const height = useMotionValue(0)
  const opacity = useMotionValue(0)
  const scale = useMotionValue(1)
  const y = useMotionValue(0)
  let entered = false
  let heightAnim: Stoppable | undefined
  useResizeObserver(inner, () => {
    const h = inner.value?.offsetHeight
    if (!h) return
    if (!entered) {
      entered = true
      height.set(h)
      if (skipped.value) return void opacity.set(1)
      if (reduced.value) return keep(animate(opacity, 1, { duration: 0.6, ease: 'easeOut' }))
      scale.set(0.94)
      y.set(14)
      const spring = { type: 'spring', stiffness: 70, damping: 16 } as const
      keep(animate(opacity, 1, spring))
      keep(animate(scale, 1, spring))
      keep(animate(y, 0, spring))
      return
    }
    if (reduced.value || skipped.value) return void height.set(h)
    heightAnim?.stop?.()
    heightAnim = animate(height, h, { type: 'spring', stiffness: 90, damping: 20 })
    keep(heightAnim)
  })
  return { height, opacity, scale, y }
}
