import { ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import { unlock } from '../audio/sfx'
import { requestOrientationPermission } from './useTilt'

/**
 * Seuil du premier geste : les navigateurs gardent l’AudioContext suspendu avant un geste de la personne ;
 * sans geste, les premiers coups seraient muets. `awaiting` reste vrai jusqu’à `approach()` (ou si un geste a déjà eu lieu : faux d’emblée).
 * Après le geste, un instant de grâce laisse le contexte passer à « running » (scheduleKnocks le verra actif).
 */
export const useApproach = (prepare: () => Promise<unknown>, graceMs = 120) => {
  const awaiting = ref(!navigator.userActivation?.hasBeenActive)
  const { start: end } = useTimeoutFn(() => (awaiting.value = false), graceMs, { immediate: false })
  const approach = () => {
    unlock()
    requestOrientationPermission()
    prepare().then(end, () => undefined)
  }
  return { awaiting, approach }
}
