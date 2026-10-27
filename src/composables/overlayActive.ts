interface OverlayRoot {
  querySelector: (selectors: string) => unknown
  querySelectorAll: (selectors: string) => Iterable<{ offsetParent: unknown }>
}

// Une fenêtre (dialogue ouvert) ou un menu a-t-il la main ? Lu à l’instant de la touche, logique pure testable sans DOM :
// - un dialogue est ouvert (fenêtre modale : rien d’autre ne doit réagir) ;
// - ou un menu est visible (le menu Démarrer reste dans le DOM en v-show : seul un menu avec offsetParent compte).
// Inutile d’examiner l’élément focalisé : s’il est dans un dialogue ouvert ou un menu visible, ces deux tests le couvrent déjà.
export const isOverlayActive = (root: OverlayRoot): boolean => !!root.querySelector('dialog[open]') || [...root.querySelectorAll('[role=menu]')].some((m) => m.offsetParent)
