import { throttleFilter, useIdle, useTimeoutFn } from '@vueuse/core'
import { ref, watch } from 'vue'
import { OUTCOME_MS, type Outcome, type Phase } from '../engine/activityTiming'

// Délai de réussite automatique : une activité se réussit toujours, même sans y toucher.
export const AUTO_SUCCESS_MS = 20_000
// Au bout de ce délai sans réussite ni interaction, un bouton « Passer » discret apparaît (la minuterie automatique reste le filet de sécurité).
export const SKIP_REVEAL_MS = 12_000
// Intervalle minimal entre deux réarmements de la minuterie de « Passer » (les mouvements du pointeur arrivent par rafales).
export const POKE_THROTTLE_MS = 250

// Fin d’activité commune : `finish` n’émet qu’une fois (réussite du joueur ou minuterie, le premier gagne)
// `onFinish` s’exécute à cette fin, quel qu’en soit le chemin (réussite ou minuterie), et `done` attend `delayMs` pour laisser l’animation de réussite se jouer. Les minuteries meurent avec le composant.
export const useActivityDone = (
  emit: () => void,
  {
    autoMs = AUTO_SUCCESS_MS,
    delayMs,
    skipMs = SKIP_REVEAL_MS,
    durationMs,
    onFinish,
  }: { autoMs?: number; delayMs?: number; skipMs?: number; durationMs?: number; onFinish?: (o: Outcome) => void } = {},
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
  const settle = (result: Outcome) => {
    if (finished) return
    finished = true
    outcome.value = result
    auto.stop()
    stopIdle()
    canSkip.value = false
    onFinish?.(result)
    emitLater()
  }
  const finish = () => settle('win')
  // Démarrage explicite : `immediate` de VueUse ne démarre que si `window` existe (rien dans les tests).
  const auto = useTimeoutFn(timed ? () => settle('fail') : finish, durationMs ?? autoMs, { immediate: false })
  auto.start()
  // « Passer » dépanne qui reste bloqué : après `revealAt` sans interaction, il apparaît (qui joue ne le voit jamais, la réussite automatique arrive avant).
  // `pointermove` compte aussi : certaines activités se jouent au survol (suivre les feux follets), sans aucun clic.
  // Il tire des dizaines d’événements par seconde : le filtre limite les réarmements (au plus un tous les 250 ms, et le dernier événement d’une rafale réarme quand même après la fenêtre, jamais avant),
  // ce qui retarde l’apparition de « Passer » de 250 ms au plus. `idle` repasse à faux à la reprise d’activité : le verrou le garde affiché,
  // il ne doit pas fuir sous le doigt de qui veut l’atteindre. Pas de `window` (SSR, tests node) : aucune minuterie, jamais d’aide.
  const { idle, stop: stopIdle } = useIdle(revealAt, {
    events: ['pointerdown', 'pointermove', 'keydown'],
    eventFilter: throttleFilter(POKE_THROTTLE_MS),
    listenForVisibilityChange: false,
  })
  watch(
    idle,
    (isIdle) => {
      if (isIdle && !finished) canSkip.value = true
    },
    { flush: 'sync' },
  )
  return { finish, canSkip, outcome, startedAt, isFinished: () => finished }
}
