import { useActiveElement } from '@vueuse/core'

const OVERLAY = 'dialog[open], [role=menu]'

interface OverlayRoot {
  querySelector: (selectors: string) => unknown
  querySelectorAll: (selectors: string) => Iterable<{ offsetParent: unknown }>
}

// Une fenêtre (dialogue ouvert) ou un menu a-t-il la main ? Logique pure, testable sans DOM :
// - la cible de l’événement ou l’élément focalisé se trouve dans un dialogue ouvert ou un menu ;
// - ou un dialogue est ouvert quelque part (fenêtre modale : rien d’autre ne doit réagir) ;
// - ou un menu est visible (le menu Démarrer reste dans le DOM en v-show : seul un menu avec offsetParent compte).
export const isOverlayActive = (target: unknown, focused: unknown, root: OverlayRoot): boolean => {
  const inOverlay = (n: unknown) => n instanceof Element && !!n.closest(OVERLAY)
  return inOverlay(target) || inOverlay(focused) || !!root.querySelector('dialog[open]') || [...root.querySelectorAll('[role=menu]')].some((m) => m.offsetParent)
}

// Renvoie `(e) => boolean` : vrai quand une fenêtre ou un menu prend la touche (à appeler au moment de l’événement).
export const useOverlayOpen = () => {
  const focused = useActiveElement()
  return (e: Event) => isOverlayActive(e.target, focused.value, document)
}
