interface OverlayRoot {
  querySelector: (selectors: string) => unknown
  querySelectorAll: (selectors: string) => Iterable<{ offsetParent: unknown }>
}

// Une fenêtre (dialogue ouvert) ou un menu a-t-il la main ? Logique pure, testable sans DOM :
// - la cible de l’événement (l’élément focalisé à l’instant de la touche) se trouve dans un dialogue ouvert ou dans un menu visible ;
//   un élément détaché du DOM, ou dans un menu masqué, ne compte pas ;
// - ou un dialogue est ouvert quelque part (fenêtre modale : rien d’autre ne doit réagir) ;
// - ou un menu est visible (le menu Démarrer reste dans le DOM en v-show : seul un menu avec offsetParent compte).
export const isOverlayActive = (target: unknown, root: OverlayRoot): boolean => {
  const inOverlay = (n: unknown) => {
    if (!(n instanceof Element) || !n.isConnected) return false
    const menu = n.closest('[role=menu]') as HTMLElement | null
    return !!n.closest('dialog[open]') || (!!menu && !!menu.offsetParent)
  }
  return inOverlay(target) || !!root.querySelector('dialog[open]') || [...root.querySelectorAll('[role=menu]')].some((m) => m.offsetParent)
}
