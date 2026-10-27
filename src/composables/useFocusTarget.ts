import { computed, watch, type ComponentPublicInstance, type Ref, type ShallowRef } from 'vue'
import { unrefElement } from '@vueuse/core'
import { focusQuietly } from './focusQuietly'

export type Focusable = HTMLElement | ComponentPublicInstance | { focus: () => void }
type MaybeFocusable = Focusable | null | undefined

/**
 * Traduit une cible de focus nommée (posée par la logique de jeu) en vrai focus, une fois l’élément monté.
 *
 * Pas de sondage : si l’écran visé n’est pas encore monté (AnimatePresence en mode wait, scène paresseuse), sa ref passe
 * plus tard de null à l’élément, ce qui relance le watcher. Changer de cible entre-temps annule l’attente.
 * `target` est remis à null dès que la cible est résolue, que le focus ait été déplacé ou non.
 *
 * Garde anti-vol : on ne déplace pas un focus que la personne a posé ailleurs. Déplacement permis depuis <body>
 * (l’écran précédent est démonté) ou depuis l’écran précédent (dans `area`) ; vers `guarded` (« Fermer la porte »,
 * carte retournée) seulement depuis `from` : quelqu’un qui lit la carte au lecteur d’écran n’est pas dérangé.
 */
export const useFocusTarget = <T extends string>(options: {
  target: Ref<T | null>
  refs: Partial<Record<T, Readonly<Ref<MaybeFocusable>> | ShallowRef<MaybeFocusable>>>
  area: Readonly<Ref<HTMLElement | null>>
  guarded?: { target: T; from: Readonly<Ref<HTMLElement | null>> }
}) => {
  const { target, refs, area, guarded } = options
  const targetEl = computed<MaybeFocusable>(() => (target.value ? (refs[target.value]?.value ?? null) : null))

  const mayMoveFocus = (t: T, el: Focusable) => {
    const a = document.activeElement
    if (!a || a === document.body) return true
    if (guarded && t === guarded.target) return a === guarded.from.value
    const dom = unrefElement(el as HTMLElement | ComponentPublicInstance)
    if (dom instanceof Element && dom !== a && dom.contains(a)) return false
    return !!area.value?.contains(a)
  }

  watch(
    targetEl,
    (el) => {
      const t = target.value
      if (!t || !el) return
      target.value = null
      if (!mayMoveFocus(t, el)) return
      // La porte, DeckCut et Finale exposent `focus()` (ils savent quoi focaliser) ; les autres cibles sont des éléments (ou des composants dont on prend l’élément racine).
      if (!(el instanceof HTMLElement) && 'focus' in el && typeof el.focus === 'function') el.focus()
      else {
        const dom = unrefElement(el as HTMLElement | ComponentPublicInstance)
        if (dom instanceof HTMLElement) focusQuietly(dom, { preventScroll: true })
      }
    },
    { flush: 'post' },
  )
}
