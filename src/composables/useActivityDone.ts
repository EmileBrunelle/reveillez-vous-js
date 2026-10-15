import { useTimeoutFn } from '@vueuse/core'

// Délai de réussite automatique : une activité se réussit toujours, même sans y toucher.
export const AUTO_SUCCESS_MS = 20_000

// Fin d’activité commune : `finish` n’émet qu’une fois (réussite du joueur ou minuterie, le premier gagne)
// `onFinish` s’exécute à cette fin, quel qu’en soit le chemin (réussite ou minuterie), et `done` attend `delayMs` pour laisser l’animation de réussite se jouer. Les minuteries meurent avec le composant.
export const useActivityDone = (emit: () => void, { autoMs = AUTO_SUCCESS_MS, delayMs = 900, onFinish }: { autoMs?: number; delayMs?: number; onFinish?: () => void } = {}) => {
  let finished = false
  const { start: emitLater } = useTimeoutFn(emit, delayMs, { immediate: false })
  const finish = () => {
    if (finished) return
    finished = true
    auto.stop()
    onFinish?.()
    emitLater()
  }
  // Démarrage explicite : `immediate` de VueUse ne démarre que si `window` existe (rien dans les tests).
  const auto = useTimeoutFn(finish, autoMs, { immediate: false })
  auto.start()
  return { finish, isFinished: () => finished }
}
