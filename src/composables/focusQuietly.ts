import { useKeyboardModality } from './useKeyboardModality'

const keyboard = useKeyboardModality()

/** focus() sans anneau (:focus-visible) si la dernière interaction venait de la souris ou du doigt ; inchangé après le clavier. */
export const focusQuietly = (el: HTMLElement | SVGElement | null | undefined, options: FocusOptions = {}) => {
  if (!el) return
  el.focus(keyboard.value ? options : ({ ...options, focusVisible: false } as FocusOptions))
}

/** Élément HTML actuellement focalisé, ou null (le body compte comme un élément). */
export const activeHtmlElement = () => (document.activeElement instanceof HTMLElement ? document.activeElement : null)
