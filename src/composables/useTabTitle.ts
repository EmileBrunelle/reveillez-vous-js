import { watch, type Ref } from 'vue'
import { useDocumentVisibility } from '@vueuse/core'
import { prophecies } from '../content/prophecies'
import { nextTabTitle } from '../engine/prophecy'
import { secureRng } from '../engine/rng'
import { safeStorage } from './safeStorage'

export const BASE_TITLE = 'Réveillez-vous.js'

/** Quand l’onglet est caché, le titre devient une ligne du niveau (une seule fois par masquage, jamais de clignotement) ; il revient à la normale au retour. */
export const useTabTitle = (level: Ref<number>) => {
  const rng = secureRng()
  const visibility = useDocumentVisibility()
  watch(visibility, (v, old) => {
    if (v === 'hidden' && old !== 'hidden') document.title = nextTabTitle(prophecies, level.value, safeStorage(), rng, BASE_TITLE)
    else if (v === 'visible') document.title = BASE_TITLE
  })
}
