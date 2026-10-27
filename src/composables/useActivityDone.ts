import { useTimeoutFn } from '@vueuse/core'
import { ref } from 'vue'

// Délai de réussite automatique : une activité se réussit toujours, même sans y toucher.
export const AUTO_SUCCESS_MS = 20_000
// Au bout de ce délai sans réussite, un bouton « Passer » discret apparaît (la minuterie automatique reste le filet de sécurité).
export const SKIP_REVEAL_MS = 12_000

// Fin d’activité commune : `finish` n’émet qu’une fois (réussite du joueur ou minuterie, le premier gagne)
// `onFinish` s’exécute à cette fin, quel qu’en soit le chemin (réussite ou minuterie), et `done` attend `delayMs` pour laisser l’animation de réussite se jouer. Les minuteries meurent avec le composant.
export const useActivityDone = (
  emit: () => void,
  { autoMs = AUTO_SUCCESS_MS, delayMs = 900, skipMs = SKIP_REVEAL_MS, onFinish }: { autoMs?: number; delayMs?: number; skipMs?: number; onFinish?: () => void } = {},
) => {
  let finished = false
  const canSkip = ref(false)
  const { start: emitLater } = useTimeoutFn(emit, delayMs, { immediate: false })
  const finish = () => {
    if (finished) return
    finished = true
    auto.stop()
    reveal.stop()
    canSkip.value = false
    onFinish?.()
    emitLater()
  }
  // Démarrage explicite : `immediate` de VueUse ne démarre que si `window` existe (rien dans les tests).
  const auto = useTimeoutFn(finish, autoMs, { immediate: false })
  auto.start()
  const reveal = useTimeoutFn(() => (canSkip.value = !finished), skipMs, { immediate: false })
  reveal.start()
  return { finish, canSkip, isFinished: () => finished }
}
