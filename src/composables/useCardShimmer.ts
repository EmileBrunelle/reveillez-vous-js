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
// Avec `immediate: false`, VueUse crée l’Animation au montage et la laisse en pause à t = 0 : son premier keyframe
// (`translateX(-130%)`) resterait appliqué à l’élément. On l’annule donc aussitôt (état idle, aucun effet) ; `play()` la relance depuis le début.
export const useCardShimmer = (el: Readonly<Ref<HTMLElement | null>>) => {
  // Garde : si `shimmer()` précède la création de l’Animation, `onReady` ne doit pas annuler ce premier reflet.
  let played = false
  const { play, playState } = useAnimate(el, KEYFRAMES, {
    duration: 750,
    easing: 'ease-in-out',
    immediate: false,
    onReady: (animation) => {
      if (!played) animation.cancel()
    },
  })
  const shimmering = computed(() => playState.value === 'running')
  const shimmer = () => {
    played = true
    play()
  }
  return { shimmer, shimmering }
}
