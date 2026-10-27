import { effectScope } from 'vue'
import { useTimeoutFn } from '@vueuse/core'

/**
 * Exécute `fn` dans `ms` ms, même si l’appelant a déjà arrêté sa propre portée (c’est le but : libérer des nœuds
 * après un fondu de sortie). La minuterie vit dans une portée détachée, libérée dès que `fn` a tourné.
 */
export const runLater = (fn: () => void, ms: number) => {
  const scope = effectScope(true)
  scope.run(() => {
    const { start } = useTimeoutFn(
      () => {
        fn()
        scope.stop()
      },
      ms,
      { immediate: false },
    )
    start() // explicite : `immediate` ne démarre rien hors navigateur (tests en node)
  })
}
