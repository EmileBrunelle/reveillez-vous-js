import { watch, type Ref } from 'vue'
import { useDocumentVisibility, useTitle } from '@vueuse/core'
import { prophecies } from '../content/prophecies'
import type { ParanoiaLevel } from '../engine/paranoia'
import { nextTabTitle } from '../engine/prophecy'
import { secureRng } from '../engine/rng'
import { safeStorage } from './safeStorage'

export const BASE_TITLE = 'Réveillez-vous.js'

/** Quand l’onglet est caché, le titre devient une ligne du niveau (une seule fois par masquage, jamais de clignotement) ; il revient à la normale au retour. */
export const useTabTitle = (level: Ref<ParanoiaLevel>) => {
  const rng = secureRng()
  const visibility = useDocumentVisibility()
  const title = useTitle(BASE_TITLE)
  watch(visibility, (v) => {
    title.value = v === 'hidden' ? nextTabTitle(prophecies, level.value, safeStorage(), rng, BASE_TITLE) : BASE_TITLE
  })
}
