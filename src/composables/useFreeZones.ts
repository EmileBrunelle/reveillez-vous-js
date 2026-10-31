import { useResizeObserver, useScreenSafeArea } from '@vueuse/core'
import type { Box } from '../engine/freeZones'
import { useLayoutRefs } from './layoutRefs'

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
}

/**
 * Mesures de la page pour les fausses fenêtres (le DOM est lu ici, jamais dans le composant) : `avoidBoxes()` (ce qu’une fenêtre ne doit pas couvrir),
 * `area()` (zone sûre, au-dessus de la barre des tâches). `onChange` est appelé quand la carte ou la colonne principale change de taille.
 */
export const useFreeZones = (onChange: () => void) => {
  // Éléments de la page enregistrés par App, la carte et la barre des tâches (aucune requête par nom de classe).
  const { mainEl, tarotEl, taskbarEl } = useLayoutRefs()
  // Tout ce qui est interactif ou porte la scène, plus l’emplacement de la bulle (au-dessus de la zone de notification).
  const avoidBoxes = (): Box[] => {
    // `.door-hit` est un bouton de la scène : la requête bornée à la colonne principale le couvre.
    const targets = [...(mainEl.value?.querySelectorAll('button, a, [role="button"]') ?? [])]
    for (const el of [tarotEl.value, taskbarEl.value]) if (el) targets.push(el)
    const boxes = targets.map(boxOf)
    boxes.push({ left: window.innerWidth - 20 * 16, top: window.innerHeight - 10 * 16, right: window.innerWidth, bottom: window.innerHeight })
    return boxes
  }
  // Zone sûre (encoche, coins arrondis) : VueUse relit les env(safe-area-inset-*) résolus à chaque redimensionnement, rotation comprise.
  const insets = useScreenSafeArea()
  const px = (v: string) => parseFloat(v) || 0
  const area = (): Box => ({
    left: px(insets.left.value),
    top: px(insets.top.value),
    right: window.innerWidth - px(insets.right.value),
    bottom: taskbarEl.value?.getBoundingClientRect().top ?? window.innerHeight,
  })
  // La carte et la colonne changent de taille (retournement, polices, orientation) : on prévient à chaque changement.
  useResizeObserver([tarotEl, mainEl], onChange)
  return { avoidBoxes, area }
}
