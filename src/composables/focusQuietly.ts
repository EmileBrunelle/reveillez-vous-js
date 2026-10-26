import { useEventListener } from '@vueuse/core'

// Modalité de la dernière entrée : un focus programmatique ne doit montrer l’anneau (:focus-visible) qu’après le clavier.
// Chrome l’affiche aussi après un focus() déclenché par une action à la souris ou au doigt : on le coupe alors.
let lastInput: 'keyboard' | 'pointer' = 'pointer' // sans entrée connue : pointeur (pas d’anneau au tout premier chargement)

if (typeof window !== 'undefined') {
  useEventListener(window, 'keydown', () => (lastInput = 'keyboard'), { capture: true, passive: true })
  useEventListener(window, 'pointerdown', () => (lastInput = 'pointer'), { capture: true, passive: true })
}

/** focus() sans anneau si la dernière interaction venait de la souris ou du doigt ; inchangé après le clavier. */
export const focusQuietly = (el: HTMLElement | null | undefined, options: FocusOptions = {}) => {
  if (!el) return
  el.focus(lastInput === 'pointer' ? ({ ...options, focusVisible: false } as FocusOptions) : options)
}
