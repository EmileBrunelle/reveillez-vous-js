import { nextTick, watch, type Ref } from 'vue'
import { useActiveElement } from '@vueuse/core'

/**
 * Retour du focus : le dernier élément focalisé hors de `root` (ex. « Fermer la porte ») le récupère à la fermeture d’une fenêtre, sinon la fenêtre suivante ;
 * sans cela, le bouton retiré du DOM laisse le focus tomber sur <body>. `next()` donne la fenêtre suivante (référence de gabarit) ; `close(remove)` retire la fenêtre (callback) puis replace le focus si besoin.
 */
export const useFocusReturn = (root: Readonly<Ref<HTMLElement | null>>, next: () => HTMLElement | undefined) => {
  const active = useActiveElement()
  let lastOutside: HTMLElement | null = null
  watch(active, (el) => {
    if (el instanceof HTMLElement && el !== document.body && !root.value?.contains(el)) lastOutside = el
  })
  return async (remove: () => void) => {
    const hadFocus = !!root.value?.contains(active.value ?? null)
    remove()
    if (!hadFocus) return
    await nextTick()
    const target = next() ?? (lastOutside?.isConnected ? lastOutside : null)
    target?.focus()
  }
}
