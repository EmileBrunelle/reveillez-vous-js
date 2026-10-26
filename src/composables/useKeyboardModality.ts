import { ref } from 'vue'

/** Vrai tant que la dernière interaction était au clavier (état partagé) : le focus programmatique après un clic ou un tap ne doit pas dessiner d’anneau. */
const keyboard = ref(false)
let installed = false
const KEYS = new Set(['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export const useKeyboardModality = () => {
  if (!installed && typeof window !== 'undefined') {
    installed = true
    // Écouteurs de module (durée de vie de la page) : un useEventListener serait lié au premier composant et s’arrêterait avec lui.
    window.addEventListener('keydown', (e) => void (KEYS.has(e.key) && (keyboard.value = true)), true)
    window.addEventListener('pointerdown', () => (keyboard.value = false), true)
  }
  return keyboard
}
