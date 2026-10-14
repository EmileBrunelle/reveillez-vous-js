import { computed } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'

// Source unique du réglage « mouvement réduit » (VueUse), exposée comme booléen.
export const useReducedMotion = () => {
  const preferred = usePreferredReducedMotion()
  return computed(() => preferred.value === 'reduce')
}
