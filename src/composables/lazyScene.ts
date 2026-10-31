import { computed, defineAsyncComponent, defineComponent, h, ref, shallowRef, watch, type Component } from 'vue'
import ChunkFailed from '../components/ChunkFailed.vue'
import { tryAutoReload } from './chunkReload'

type Loader = () => Promise<{ default: Component }>
type Focusable = { focus?: () => void }

/**
 * Scène chargée à la demande qui ne bloque jamais la partie : si le chunk échoue, la page se recharge d’elle-même une fois (voir chunkReload) ;
 * sinon (hors ligne, échec répété), le repli `ChunkFailed` s’affiche
 * (« Réessayer » recharge la page, « Passer » appelle `skip`, s’il est fourni).
 * Pas de nouvel essai en place : le navigateur garde en cache un `import()` échoué pour la même URL, un retry rappellerait l’échec ;
 * un rechargement (recette Vite pour `vite:preloadError`) repart d’un cache propre, et la partie survit (visites en sessionStorage, sacs en localStorage).
 * Les attributs, écouteurs et fentes traversent l’enveloppe ; son `focus()` exposé est différé jusqu’à ce que la scène (ou le repli) soit montée.
 */
export const lazyScene = (loader: Loader, skip?: () => void) => {
  return defineComponent({
    name: 'LazyScene',
    inheritAttrs: false,
    setup(_, { attrs, slots, expose }) {
      const failed = ref(false)
      const Async = defineAsyncComponent({
        loader,
        onError: (_error, _retry, fail) => {
          if (tryAutoReload()) return fail()
          failed.value = true // l’enveloppe affiche le repli elle-même (pour garder sa ref)
          fail()
        },
        errorComponent: () => null, // sans errorComponent, Vue relance l’erreur ; le repli est celui de l’enveloppe
      })
      const inner = shallowRef<Focusable | null>(null)
      const fallback = shallowRef<Focusable | null>(null)
      const target = computed(() => (failed.value ? fallback.value : inner.value))
      // `focus()` peut être demandé avant que le chunk soit résolu (App le fait dès que sa ref existe) : on garde la demande jusqu’au montage.
      let wanted = false
      const flush = (t: Focusable | null) => {
        if (!wanted || !t?.focus) return
        wanted = false
        t.focus()
      }
      watch(target, flush, { flush: 'post' })
      expose({
        focus: () => {
          wanted = true
          flush(target.value)
        },
      })
      return () => (failed.value ? h(ChunkFailed, { ref: fallback, skippable: !!skip, onRetry: () => location.reload(), onSkip: skip }) : h(Async, { ...attrs, ref: inner }, slots))
    },
  })
}
