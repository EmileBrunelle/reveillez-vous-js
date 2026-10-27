import { computed, ref } from 'vue'
import { tryOnMounted, useEventListener } from '@vueuse/core'

/**
 * Bascule plein écran sur la page entière. `supported` est faux quand l’API est absente (p. ex. Safari iPhone).
 * L’état est lu sur `document.fullscreenElement` et suit `fullscreenchange` : `useFullscreen` de VueUse se fie
 * d’abord à `webkitIsFullScreen`, qui dans Chromium peut se dire actif sans élément plein écran.
 * `doc` est injectable pour les tests.
 */
export const useFullscreenToggle = (doc: Document | undefined = globalThis.document) => {
  const supported = ref(false)
  const isFullscreen = ref(false)
  const sync = () => (isFullscreen.value = !!doc?.fullscreenElement)
  tryOnMounted(() => {
    supported.value = doc?.fullscreenEnabled === true
    sync()
  })
  useEventListener(() => doc, 'fullscreenchange', sync)
  const label = computed(() => (isFullscreen.value ? 'Quitter le plein écran' : 'Passer en plein écran'))
  /** Entre ou sort du plein écran ; un refus du navigateur est ignoré. */
  const toggle = () => {
    if (!doc) return
    void (doc.fullscreenElement ? doc.exitFullscreen() : doc.documentElement.requestFullscreen()).catch(() => {})
  }
  return { supported, isFullscreen, label, toggle }
}
