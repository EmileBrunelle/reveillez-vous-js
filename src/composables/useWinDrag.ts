import { computed, ref, watch, type Ref } from 'vue'
import { useDraggable, useMediaQuery, useResizeObserver, useWindowSize } from '@vueuse/core'

export type Offset = { x: number; y: number }
// Fenêtre au repos (décalage nul), en pixels de la fenêtre d’affichage.
export type RestRect = { left: number; top: number; width: number }
export type Bounds = { vw: number; vh: number; taskbar: number; bar: number; grab: number }

// Largeur de la fenêtre toujours visible de chaque côté : de quoi la rattraper à la souris ou au doigt.
export const GRAB = 64

// Si la zone est plus petite que la fenêtre (hi < lo), on garde la borne basse : la barre de titre reste en haut de l’écran.
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(hi, lo))

/**
 * Borne le décalage d’une fenêtre : la barre de titre reste entre le haut de l’écran et la barre des tâches,
 * et au moins `grab` px de la fenêtre restent visibles à gauche et à droite.
 * Fonction pure : `rest` est la position sans décalage, donc la borne ne dépend pas du glissement en cours.
 */
export const clampOffset = (want: Offset, rest: RestRect, b: Bounds): Offset => ({
  x: clamp(want.x, b.grab - rest.left - rest.width, b.vw - b.grab - rest.left),
  y: clamp(want.y, -rest.top, b.vh - b.taskbar - b.bar - rest.top),
})

// Hauteur réelle de `--taskbar-h` (calc avec rem et zone sûre) : on la mesure avec une sonde.
const taskbarHeight = (host: HTMLElement) => {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--taskbar-h)'
  host.append(probe)
  const h = probe.offsetHeight
  probe.remove()
  return h
}

/**
 * Déplacement d’une fenêtre façon Windows 98 par sa barre de titre (jamais par le contenu ni les boutons).
 * `host` donne l’élément à déplacer depuis la barre (par défaut le <dialog> englobant ; une fenêtre non modale passe sa propre racine).
 * `style` se lie sur le <dialog> : la propriété `translate` se compose avec `transform` sans casser
 * le centrage (`m-auto`), le `::backdrop` ni l’animation d’entrée. À chaque ouverture, retour à la position par défaut.
 * `enabled` coupe le glissement (fenêtre fixe, ex. « À propos »). Désactivé sous 640 px : la fenêtre y occupe presque tout l’écran.
 */
export const useWinDrag = (
  handle: Readonly<Ref<HTMLElement | null>>,
  open: Readonly<Ref<boolean>>,
  host: (bar: HTMLElement) => HTMLElement | null = (bar) => bar.closest('dialog'),
  enabled: () => boolean = () => true,
) => {
  const narrow = useMediaQuery('(max-width: 639.98px)')
  const offset = ref<Offset>({ x: 0, y: 0 })
  let startPointer: Offset = { x: 0, y: 0 }
  let startOffset: Offset = { x: 0, y: 0 }
  let rest: RestRect = { left: 0, top: 0, width: 0 }
  let bounds: Bounds = { vw: 0, vh: 0, taskbar: 0, bar: 0, grab: GRAB }

  const { isDragging } = useDraggable(handle, {
    handle,
    pointerTypes: ['mouse', 'pen', 'touch'],
    preventDefault: true,
    onStart: (_pos, e) => {
      const bar = handle.value
      const dialog = bar ? host(bar) : null
      // Pas de glissement sur les boutons de la barre (la croix reste cliquable) ni sur écran étroit.
      if (!bar || !dialog || narrow.value || !enabled() || (e.target as Element).closest('button')) return false
      const r = dialog.getBoundingClientRect()
      startPointer = { x: e.clientX, y: e.clientY }
      startOffset = { ...offset.value }
      rest = { left: r.left - startOffset.x, top: r.top - startOffset.y, width: r.width }
      bounds = { vw: window.innerWidth, vh: window.innerHeight, taskbar: taskbarHeight(dialog), bar: bar.offsetHeight, grab: GRAB }
    },
    onMove: (_pos, e) => {
      offset.value = clampOffset({ x: startOffset.x + e.clientX - startPointer.x, y: startOffset.y + e.clientY - startPointer.y }, rest, bounds)
    },
  })

  watch(open, () => (offset.value = { x: 0, y: 0 }))

  // Redimensionnement, rotation, plein écran, barre d’outils mobile : une fenêtre déjà déplacée est reprise dans la zone visible.
  const reclamp = () => {
    const bar = handle.value
    const dialog = bar ? host(bar) : null
    if (!bar || !dialog || !open.value || (!offset.value.x && !offset.value.y)) return
    if (narrow.value) {
      offset.value = { x: 0, y: 0 }
      return
    }
    const r = dialog.getBoundingClientRect()
    const at = { left: r.left - offset.value.x, top: r.top - offset.value.y, width: r.width }
    const next = clampOffset(offset.value, at, { vw: window.innerWidth, vh: window.innerHeight, taskbar: taskbarHeight(dialog), bar: bar.offsetHeight, grab: GRAB })
    if (next.x !== offset.value.x || next.y !== offset.value.y) offset.value = next
  }
  const { width, height } = useWindowSize()
  watch([width, height, narrow], reclamp, { flush: 'post' })
  useResizeObserver(() => (handle.value ? host(handle.value) : null), reclamp) // taille de la fenêtre elle-même

  const style = computed(() => (offset.value.x || offset.value.y ? { translate: `${offset.value.x}px ${offset.value.y}px` } : undefined))
  return { style, offset, isDragging, narrow }
}
