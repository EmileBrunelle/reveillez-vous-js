import { ref } from 'vue'
import { useEventListener } from '@vueuse/core'

// Touches de navigation qui basculent en mode clavier. Les modificatrices seules (Shift, Ctrl, Alt, Meta) et les autres touches ne comptent pas.
const NAV_KEYS = new Set(['Tab', 'Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

/** Cette touche enfoncée fait-elle passer en mode clavier ? (fonction pure, testée) */
export const keyEntersKeyboardMode = (key: string) => NAV_KEYS.has(key)

/** Source de vérité unique : vrai tant que la dernière entrée était au clavier ; faux au chargement et après un pointeur. */
const keyboard = ref(false)

// Écouteurs de module (durée de vie de la page), en capture pour voir les événements avant qu’un handler ne les stoppe.
if (typeof window !== 'undefined') {
  useEventListener(window, 'keydown', (e: KeyboardEvent) => void (keyEntersKeyboardMode(e.key) && (keyboard.value = true)), { capture: true, passive: true })
  useEventListener(window, 'pointerdown', () => (keyboard.value = false), { capture: true, passive: true })
}

export const useKeyboardModality = () => keyboard
