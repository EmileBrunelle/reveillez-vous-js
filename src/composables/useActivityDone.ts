import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { ref } from 'vue'
import { OUTCOME_MS, type Phase } from '../engine/activityTiming'

// Délai de réussite automatique : une activité se réussit toujours, même sans y toucher.
export const AUTO_SUCCESS_MS = 20_000
// Au bout de ce délai sans réussite ni interaction, un bouton « Passer » discret apparaît (la minuterie automatique reste le filet de sécurité).
export const SKIP_REVEAL_MS = 12_000

// Fin d’activité commune : `finish` n’émet qu’une fois (réussite du joueur ou minuterie, le premier gagne)
// `onFinish` s’exécute à cette fin, quel qu’en soit le chemin (réussite ou minuterie), et `done` attend `delayMs` pour laisser l’animation de réussite se jouer. Les minuteries meurent avec le composant.
export const useActivityDone = (
  emit: () => void,
  { autoMs = AUTO_SUCCESS_MS, delayMs, skipMs = SKIP_REVEAL_MS, durationMs, onFinish }: { autoMs?: number; delayMs?: number; skipMs?: number; durationMs?: number; onFinish?: () => void } = {},
) => {
  // Avec `durationMs` (activité chronométrée), la fin du temps est un échec (`outcome` = 'fail') suivi de la même suite que la réussite ;
  // sans lui, la minuterie `autoMs` reste une réussite automatique. `outcome` passe de 'play' à 'win' ou 'fail', une seule fois.
  const timed = durationMs !== undefined
  const revealAt = timed ? Math.min(skipMs, durationMs * 0.6) : skipMs
  let finished = false
  const outcome = ref<Phase>('play')
  const startedAt = Date.now()
  const canSkip = ref(false)
  const { start: emitLater } = useTimeoutFn(emit, delayMs ?? (timed ? OUTCOME_MS : 900), { immediate: false })
  const settle = (result: Phase) => {
    if (finished) return
    finished = true
    outcome.value = result
    auto.stop()
    reveal.stop()
    canSkip.value = false
    onFinish?.()
    emitLater()
  }
  const finish = () => settle('win')
  // Démarrage explicite : `immediate` de VueUse ne démarre que si `window` existe (rien dans les tests).
  const auto = useTimeoutFn(timed ? () => settle('fail') : finish, durationMs ?? autoMs, { immediate: false })
  auto.start()
  const reveal = useTimeoutFn(() => (canSkip.value = !finished), revealAt, { immediate: false })
  reveal.start()
  // « Passer » dépanne qui reste bloqué : toute interaction repousse son apparition (qui joue ne le voit jamais, la réussite automatique arrive avant).
  // Une fois affiché, il reste : il ne doit pas fuir sous le doigt de qui veut l’atteindre.
  const poke = () => {
    if (finished || canSkip.value) return
    reveal.stop()
    reveal.start()
  }
  // Cible résolue à l’appel (pas de `document` en SSR ni dans les tests node).
  const doc = () => globalThis.document
  // pointermove compte aussi : certaines activités se jouent au survol (suivre les feux follets), sans aucun clic.
  useEventListener(doc, ['pointerdown', 'pointermove'], poke, { passive: true })
  useEventListener(doc, 'keydown', poke)
  return { finish, canSkip, outcome, startedAt, isFinished: () => finished }
}
