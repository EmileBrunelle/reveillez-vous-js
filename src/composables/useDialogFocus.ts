import { nextTick, watch, type Ref } from 'vue'
import { useOverlayRegistration } from '../stores/overlay'
import { activeHtmlElement, focusQuietly } from './focusQuietly'

/**
 * Focus d’un dialogue natif piloté par un v-model, rendu « sans anneau » (focusQuietly) hors clavier.
 *
 * - À l’ouverture : mémorise le déclencheur (watcher synchrone, donc avant le `showModal()` de v0),
 *   puis met le focus sur `initial` s’il est fourni. `Dialog` de v0 ne gère aucun focus ; `AlertDialog`
 *   focalise déjà « Annuler » (`cancelEl.focus()`) : ResetConfirm n’a donc pas besoin d’`initial`.
 * - `restore()` (à brancher sur `@close`) rend le focus au déclencheur. La spec HTML le fait déjà au `close()`
 *   d’un <dialog> (avant l’événement `close`) : `restore()` ne rentre pas en conflit, c’est un `focus()` sur
 *   l’élément déjà focalisé (sans effet), et un filet quand la restauration native n’a pas eu lieu.
 */
export const useDialogFocus = (open: Readonly<Ref<boolean>>, initial?: () => HTMLElement | SVGElement | null | undefined) => {
  useOverlayRegistration(open) // un dialogue ouvert a la main sur le clavier (ex. épellation de la planche Ouija)
  let opener: HTMLElement | null = null
  watch(
    open,
    async (o) => {
      if (!o) return
      opener = activeHtmlElement()
      await nextTick() // composant async : il peut se monter alors que le parent veut déjà ouvrir
      focusQuietly(initial?.())
    },
    { immediate: true, flush: 'sync' },
  )
  const restore = () => {
    const el = opener
    opener = null
    // Le déclencheur peut avoir disparu (ex. lien retiré après une réinitialisation).
    if (el?.isConnected) focusQuietly(el)
  }
  return { restore }
}
