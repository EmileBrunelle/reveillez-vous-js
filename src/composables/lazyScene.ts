import { computed, defineAsyncComponent, defineComponent, h, ref, shallowRef, type Component } from 'vue'
import { promiseTimeout } from '@vueuse/core'
import ChunkFailed from '../components/ChunkFailed.vue'

export const CHUNK_RETRIES = 2
export const CHUNK_RETRY_DELAY_MS = 400

type Loader = () => Promise<{ default: Component }>

/** `onError` de defineAsyncComponent : deux nouveaux essais espacés, puis on abandonne (le repli « Réessayer » prend le relais). */
export const retryChunk = (_error: Error, retry: () => void, fail: () => void, attempts: number) => {
  if (attempts > CHUNK_RETRIES) return fail()
  void promiseTimeout(CHUNK_RETRY_DELAY_MS).then(retry)
}

/**
 * Scène chargée à la demande qui ne bloque jamais la partie : essais automatiques (`retryChunk`), puis le repli `ChunkFailed`
 * (« Réessayer » recrée le composant asynchrone, donc relance le chargement ; « Passer » appelle `skip`, s’il est fourni).
 * Les attributs, écouteurs, fentes et le `focus()` exposé par la scène traversent l’enveloppe.
 */
export const lazyScene = (loader: Loader, skip?: () => void) =>
  defineComponent({
    name: 'LazyScene',
    inheritAttrs: false,
    setup(_, { attrs, slots, expose }) {
      const attempt = ref(0)
      const inner = shallowRef<{ focus?: () => void } | null>(null)
      expose({ focus: () => inner.value?.focus?.() })
      const Failed = () => h(ChunkFailed, { skippable: !!skip, onRetry: () => attempt.value++, onSkip: skip })
      // Une nouvelle définition par essai : defineAsyncComponent garde sa promesse échouée, il faut en recréer une pour recharger.
      const Async = computed(() => {
        void attempt.value
        return defineAsyncComponent({ loader, onError: retryChunk, errorComponent: Failed })
      })
      return () => h(Async.value, { ...attrs, ref: inner }, slots)
    },
  })
