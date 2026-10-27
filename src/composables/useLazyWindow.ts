import { nextTick, ref, watch } from 'vue'
import { activeHtmlElement, focusQuietly } from './focusQuietly'

/**
 * Fenêtre à chargement paresseux : `wanted` passe à vrai à la première ouverture et le reste (le composant n’est monté,
 * donc son chunk chargé, qu’alors), `open` est le v-model de la fenêtre, `show()` l’ouvre.
 * `open` peut aussi être mis à vrai directement (ex. un événement de gabarit) : `wanted` suit.
 * Avec `restoreFocus`, `show()` mémorise l’élément focalisé et le lui rend à la fermeture
 * (les fenêtres v0 qui gèrent leur propre focus via useDialogFocus n’en ont pas besoin).
 */
export const useLazyWindow = ({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
  const open = ref(false)
  const wanted = ref(false)
  let opener: HTMLElement | null = null
  watch(open, (o) => o && (wanted.value = true), { immediate: true })
  if (restoreFocus) {
    watch(open, (o) => {
      if (!o) nextTick(() => focusQuietly(opener))
    })
  }
  const show = () => {
    wanted.value = true
    if (restoreFocus) opener = activeHtmlElement()
    open.value = true
  }
  return { open, wanted, show }
}
