import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useDocumentVisibility, useRafFn } from '@vueuse/core'
import { useQualityStore } from '@/stores/quality'

/**
 * Mesure la durée des images (VueUse `useRafFn`) pour le gouverneur de qualité. La boucle ne tourne QUE si l’onglet est visible
 * et que `active` est vrai (une animation est en cours et le jeu n’est pas en pause) : aucune boucle au repos, aucune mesure sans
 * mouvement. Chaque reprise rouvre une seconde de grâce (les compilations de pipeline et les montages ne sont pas une mesure).
 * Limite connue : un navigateur qui plafonne rAF à 30 Hz (économiseur de batterie) se lit comme une machine lente.
 */
export const useFrameBudget = (active: MaybeRefOrGetter<boolean>) => {
  const quality = useQualityStore()
  // Débogage seulement (exclu du build de production) : la preuve en navigateur lit le niveau et les mesures.
  if (import.meta.env.DEV) (globalThis as { __rvjQuality?: unknown }).__rvjQuality = quality
  const visibility = useDocumentVisibility()
  const running = computed(() => visibility.value === 'visible' && toValue(active))
  const { pause, resume } = useRafFn(({ delta }) => quality.sample(delta), { immediate: false })
  watch(
    running,
    (r) => {
      if (r) {
        quality.warmup()
        resume()
      } else pause()
    },
    { immediate: true },
  )
}
