import { onMounted, shallowRef, watch } from 'vue'
import { useMediaQuery, useResizeObserver } from '@vueuse/core'
import type { Box } from '../engine/freeZones'

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
}

/**
 * Mesures de la page pour les fausses fenêtres (le DOM est lu ici, jamais dans le composant) : `avoidBoxes()` (ce qu’une fenêtre ne doit pas couvrir),
 * `area()` (zone sûre, au-dessus de la barre des tâches). `onChange` est appelé quand la carte ou la colonne principale change de taille.
 */
export const useFreeZones = (onChange: () => void) => {
  // Tout ce qui est interactif ou porte la scène, plus l’emplacement de la bulle (au-dessus de la zone de notification).
  const avoidBoxes = (): Box[] => {
    const boxes = Array.from(document.querySelectorAll('main button, main a, main [role="button"], .tarot, .door-hit, .taskbar')).map(boxOf)
    boxes.push({ left: window.innerWidth - 20 * 16, top: window.innerHeight - 10 * 16, right: window.innerWidth, bottom: window.innerHeight })
    return boxes
  }
  // Zone sûre (encoche, coins arrondis) : mesurée une seule fois, à la première utilisation ; le cache est invalidé à chaque rotation de l’écran
  // (l’encoche change de côté). Exception à « pas de style à la main » : une sonde éphémère lit les variables --safe-* résolues (env()), qu’aucun état Vue ne porte.
  let safeInsets: { t: number; r: number; l: number } | null = null
  const safe = () => {
    if (safeInsets) return safeInsets
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:var(--safe-t) var(--safe-r) 0 var(--safe-l)'
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    safeInsets = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, l: parseFloat(cs.paddingLeft) || 0 }
    probe.remove()
    return safeInsets
  }
  const portrait = useMediaQuery('(orientation: portrait)')
  watch(portrait, () => (safeInsets = null))
  const area = (): Box => {
    const s = safe()
    return { left: s.l, top: s.t, right: window.innerWidth - s.r, bottom: document.querySelector('.taskbar')?.getBoundingClientRect().top ?? window.innerHeight }
  }
  // La carte et la colonne changent de taille (retournement, polices, orientation) : on prévient à chaque changement.
  const tarotEl = shallowRef<HTMLElement | null>(null)
  const mainEl = shallowRef<HTMLElement | null>(null)
  useResizeObserver([tarotEl, mainEl], onChange)
  onMounted(() => {
    tarotEl.value = document.querySelector<HTMLElement>('.tarot')
    mainEl.value = document.querySelector<HTMLElement>('main')
  })
  return { avoidBoxes, area }
}
