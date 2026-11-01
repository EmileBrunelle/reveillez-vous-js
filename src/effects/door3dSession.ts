import { ref } from 'vue'

/**
 * Repli SVG des portes de lieu : décidé UNE fois pour toute la session, au premier vrai échec du GPU (init échouée, périphérique perdu, délai de 6 s dépassé).
 * Ainsi l’expérience reste constante d’une porte à l’autre : soit toutes les portes de lieu sont en 3D, soit toutes en SVG. Non persisté (dure autant que l’onglet).
 */
export const door3dFailed = ref(false)

/** Remise à zéro (tests seulement). */
export const resetDoor3dSession = () => {
  door3dFailed.value = false
}
