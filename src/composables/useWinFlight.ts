import { nextTick, ref, watch, type Ref } from 'vue'
import { tryOnScopeDispose } from '@vueuse/core'
import { useReducedMotion } from '@/composables/useReducedMotion'

export const FLIGHT_MS = 170 // Windows 98 (« Animer les fenêtres ») : un vol bref, de 150 à 200 ms
export const FADE_MS = 100 // mouvement réduit : simple fondu

type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>

/**
 * `transform` qui ramène le centre de la fenêtre sur celui du bouton de la barre des tâches, à la taille du bouton.
 * `transform` (et non `translate`, que useWinDrag écrit seul) : les deux se composent sans maître commun ; l’origine par défaut est le centre.
 */
export const flightTransform = (win: Rect, target: Rect) => {
  const dx = target.left + target.width / 2 - (win.left + win.width / 2)
  const dy = target.top + target.height / 2 - (win.top + win.height / 2)
  const sx = Math.max(target.width / Math.max(win.width, 1), 0.02)
  const sy = Math.max(target.height / Math.max(win.height, 1), 0.02)
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
}

/**
 * Réduction et restauration animées d’une fenêtre non modale : elle file vers son bouton de la barre des tâches en rétrécissant, et en revient.
 * Animation Web (WAAPI) sur `transform` : jouée par le compositeur, sans boucle rAF ni lecture de mise en page à chaque image (le rectangle n’est mesuré qu’une fois, au départ).
 * `hidden` passe à vrai une fois la fenêtre arrivée : elle reste dans la page (mise en page intacte) mais invisible.
 * Aucun écouteur ni observateur : seul le `watch` sur `minimized` agit, et seulement quand l’état change.
 */
export const useWinFlight = (root: Readonly<Ref<HTMLElement | null>>, id: () => number, minimized: Readonly<Ref<boolean>>) => {
  const reduced = useReducedMotion()
  const hidden = ref(false)
  let running: Animation | undefined
  let disposed = false
  tryOnScopeDispose(() => {
    disposed = true // plus aucune écriture dans `hidden` après le démontage
    running?.cancel()
  })

  const play = (el: HTMLElement, from: Keyframe, to: Keyframe, easing: string, fill: FillMode) => el.animate([from, to], { duration: reduced.value ? FADE_MS : FLIGHT_MS, easing, fill })

  // Une restauration lancée depuis le bouton de la barre des tâches y laisse le focus : on le ramène dans la fenêtre (premier bouton) une fois arrivée.
  const focusInside = (el: HTMLElement, btn: HTMLElement | null) => {
    const a = document.activeElement
    if (disposed || minimized.value || (a !== btn && a !== document.body)) return
    el.querySelector('button')?.focus()
  }

  watch(minimized, async (isMin) => {
    running?.cancel()
    running = undefined
    const el = root.value
    const btn = document.querySelector<HTMLElement>(`[data-win-btn="${id()}"]`)
    const canFly = !!el && typeof el.animate === 'function'
    if (isMin) {
      // Le focus ne doit pas tomber sur <body> : il passe au bouton de la fenêtre dans la barre des tâches.
      if (el?.contains(document.activeElement)) btn?.focus()
      if (!canFly) {
        hidden.value = true
        return
      }
      const to = reduced.value || !btn ? { opacity: 0 } : { transform: flightTransform(el.getBoundingClientRect(), btn.getBoundingClientRect()), opacity: 0.3 }
      const anim = (running = play(el, { transform: 'none', opacity: 1 }, to, 'ease-in', 'forwards'))
      await anim.finished.catch(() => undefined)
      if (disposed || running !== anim) return // démontée, ou une restauration a pris le relais
      running = undefined
      hidden.value = true
      await nextTick()
      if (!disposed) anim.cancel() // la fenêtre est masquée : on peut libérer l’animation
    } else {
      hidden.value = false
      if (!canFly) {
        await nextTick()
        if (el) focusInside(el, btn)
        return
      }
      await nextTick()
      if (disposed) return
      const from = reduced.value || !btn ? { opacity: 0 } : { transform: flightTransform(el.getBoundingClientRect(), btn.getBoundingClientRect()), opacity: 0.3 }
      const anim = (running = play(el, from, { transform: 'none', opacity: 1 }, 'ease-out', 'none'))
      await anim.finished.catch(() => undefined)
      if (running === anim) running = undefined
      focusInside(el, btn)
    }
  })

  return { hidden }
}
