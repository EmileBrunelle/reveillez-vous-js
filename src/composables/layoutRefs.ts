import { inject, provide, shallowRef, type InjectionKey, type ShallowRef } from 'vue'
import { syncRef, tryOnScopeDispose } from '@vueuse/core'

// Éléments de mise en page partagés entre composants frères : chacun enregistre le sien (`registerLayoutEl`), les autres le lisent
// sans passer par une requête DOM sur un nom de classe. `mainEl` est aussi l’élément `.app` (la colonne principale porte les deux rôles).
export type LayoutRefs = {
  mainEl: ShallowRef<HTMLElement | null>
  tarotEl: ShallowRef<HTMLElement | null>
  taskbarEl: ShallowRef<HTMLElement | null>
}

const createLayoutRefs = (): LayoutRefs => ({ mainEl: shallowRef(null), tarotEl: shallowRef(null), taskbarEl: shallowRef(null) })

const LAYOUT_KEY: InjectionKey<LayoutRefs> = Symbol('layoutRefs')

/** Appelé par App.vue : crée les références et les fournit aux descendants. */
export const provideLayoutRefs = (): LayoutRefs => {
  const refs = createLayoutRefs()
  provide(LAYOUT_KEY, refs)
  return refs
}

/** Lit les références fournies ; sans fournisseur (composant monté seul, test), des références vides locales évitent tout avertissement. */
export const useLayoutRefs = (): LayoutRefs => inject(LAYOUT_KEY, null) ?? createLayoutRefs()

/** Publie l’élément d’un `useTemplateRef` dans la référence partagée (elle repasse à `null` au démontage de l’élément). */
export const registerLayoutEl = (target: ShallowRef<HTMLElement | null>, el: Readonly<ShallowRef<HTMLElement | null>>) => {
  syncRef(el, target, { direction: 'ltr' })
  // Vue arrête le scope du composant avant de démonter son arbre (la ref de gabarit passe à null trop tard pour syncRef) :
  // on libère donc soi-même l’élément partagé, sauf si un autre composant l’a déjà remplacé.
  tryOnScopeDispose(() => {
    if (target.value === el.value) target.value = null
  })
}
