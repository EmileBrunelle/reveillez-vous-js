import { nextTick, watch, type Ref } from 'vue'
import { focusQuietly } from './focusQuietly'

/**
 * Focus d’un dialogue natif piloté par un v-model.
 * v0 (`Dialog.Content`) appelle `showModal()` mais ne gère aucun focus : on mémorise le déclencheur
 * à l’ouverture (watcher synchrone, donc avant le `showModal()` de v0), on place le focus initial
 * sur la cible, puis `restore()` (à appeler dans `@close`) le rend sans anneau à la souris ou au doigt.
 */
export const useDialogFocus = (open: Readonly<Ref<boolean>>, initial: () => HTMLElement | null | undefined) => {
  let opener: HTMLElement | null = null
  watch(
    open,
    async (o) => {
      if (!o) return
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick() // composant async : il peut se monter alors que le parent veut déjà l’ouvrir
      focusQuietly(initial())
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
