import { nextTick, ref, type Ref } from 'vue'
import { focusQuietly } from './focusQuietly'

/**
 * Menu déroulant à focus itinérant (rôle `menu`, entrées `[role="menuitem"]` à `tabindex="-1"`) : ouverture avec focus
 * sur la première entrée, ↑/↓ circulaires, Début/Fin, Échap (ferme et rend le focus au déclencheur), Tab (ferme).
 * Le clic extérieur reste au composant (`onClickOutside` appelle `close`). `active` est injectable pour les tests.
 */
export const useMenuFocus = (menu: Readonly<Ref<HTMLElement | null>>, trigger: Readonly<Ref<HTMLElement | null>>, active: () => Element | null = () => globalThis.document?.activeElement ?? null) => {
  const open = ref(false)
  const items = () => Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  const close = (refocus = false) => {
    open.value = false
    if (refocus) focusQuietly(trigger.value)
  }
  const toggle = async () => {
    open.value = !open.value
    if (open.value) {
      await nextTick()
      focusQuietly(items()[0])
    }
  }
  const onKeydown = (e: KeyboardEvent) => {
    const list = items()
    const i = list.indexOf(active() as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      list[(i + 1) % list.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      list[(i - 1 + list.length) % list.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      list[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      list[list.length - 1]?.focus()
    } else if (e.key === 'Tab') close()
  }

  return { open, toggle, close, onKeydown }
}
