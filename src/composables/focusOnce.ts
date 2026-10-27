import { focusQuietly } from './focusQuietly'

/** Ref fonction qui ne donne le focus qu’une fois par élément : Vue rappelle les refs fonction à chaque rendu, ce qui volerait le focus clavier. */
export const createFocusOnce = (focus: (el: HTMLElement) => void = focusQuietly) => {
  const done = new WeakSet<HTMLElement>()
  return (el: unknown) => {
    if (!(el instanceof HTMLElement) || done.has(el)) return
    done.add(el)
    focus(el)
  }
}
