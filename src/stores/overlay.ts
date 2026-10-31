import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { tryOnScopeDispose } from '@vueuse/core'
import { defineStore } from 'pinia'

/** Fenêtres et menus actuellement ouverts (non persisté) : tant qu’il y en a un, il a la main sur le clavier. */
export const useOverlayStore = defineStore('overlay', () => {
  const open = ref<ReadonlySet<number>>(new Set())
  const active = computed(() => open.value.size > 0)
  // Remplacement du Set à chaque changement : réactivité simple, sans proxy de collection.
  const register = (id: number) => {
    open.value = new Set(open.value).add(id)
  }
  const unregister = (id: number) => {
    const next = new Set(open.value)
    if (next.delete(id)) open.value = next
  }
  return { active, register, unregister }
})

let nextId = 1

/**
 * Reflète `open` dans le store des superpositions (identifiant unique par appel) ; se retire à la fin du scope,
 * donc une fenêtre démontée alors qu’elle est ouverte ne laisse pas d’état périmé.
 */
export const useOverlayRegistration = (open: MaybeRefOrGetter<boolean>) => {
  const store = useOverlayStore()
  const id = nextId++
  watch(
    () => toValue(open),
    (o) => (o ? store.register(id) : store.unregister(id)),
    { immediate: true, flush: 'sync' },
  )
  tryOnScopeDispose(() => store.unregister(id))
}
