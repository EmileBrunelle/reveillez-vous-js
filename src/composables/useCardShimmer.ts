import { computed, type Ref } from 'vue'
import { useAnimate } from '@vueuse/core'

// Reflet unique à la pose de la carte : une bande diagonale qui traverse l’élément en 750 ms.
const KEYFRAMES: Keyframe[] = [
  { transform: 'translateX(-130%)', opacity: 0 },
  { opacity: 1, offset: 0.25 },
  { opacity: 1, offset: 0.7 },
  { transform: 'translateX(130%)', opacity: 0 },
]

// `shimmer()` rejoue le reflet ; `shimmering` n’est vrai que pendant la lecture, donc retombe à la fin comme à l’annulation
// (l’appelant s’en sert pour ne poser `will-change` que le temps du reflet). L’animation est annulée à la destruction du scope.
export const useCardShimmer = (el: Readonly<Ref<HTMLElement | null>>) => {
  const { play, playState } = useAnimate(el, KEYFRAMES, { duration: 750, easing: 'ease-in-out', immediate: false })
  const shimmering = computed(() => playState.value === 'running')
  return { shimmer: play, shimmering }
}
