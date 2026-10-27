import { throttleFilter, useDocumentVisibility, useIdle, useTimeoutFn } from '@vueuse/core'
import { ref, watch } from 'vue'
import { ACTIVITY_GRACE_MS, OUTCOME_MS, type Outcome, type Phase } from '../engine/activityTiming'

// Délai de réussite automatique : une activité se réussit toujours, même sans y toucher.
export const AUTO_SUCCESS_MS = 20_000
// Au bout de ce délai sans réussite ni interaction, un bouton « Passer » discret apparaît (la minuterie automatique reste le filet de sécurité).
export const SKIP_REVEAL_MS = 12_000
// Intervalle minimal entre deux réarmements de la minuterie de « Passer » (les mouvements du pointeur arrivent par rafales).
export const POKE_THROTTLE_MS = 250

// Raison de pause par défaut quand l’appelant n’en donne pas.
const MANUAL = 'manuel'
// Raison de pause posée tant que l’onglet est caché (une notification ne doit pas faire échouer).
const HIDDEN = 'onglet caché'

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
  // Minuterie suspendable : `remaining` = temps de jeu restant (ms) au dernier arrêt ; `resumedAt` = début du tronçon en cours (null à l’arrêt).
  // Une activité chronométrée commence par un délai de grâce (le verbe du HUD) : la barre reste pleine, puis se vide sur `durationMs`.
  const graceMs = timed ? ACTIVITY_GRACE_MS : 0
  const totalMs = (durationMs ?? autoMs) + graceMs
  let remaining = totalMs
  let resumedAt: number | null = null
  const reasons = new Set<string>()
  const paused = ref(false)
  const canSkip = ref(false)
  const { start: emitLater } = useTimeoutFn(emit, delayMs ?? (timed ? OUTCOME_MS : 900), { immediate: false })
  const settle = (result: Outcome) => {
    if (finished) return
    finished = true
    outcome.value = result
    auto.stop()
    remaining = remainingNow()
    resumedAt = null
    stopIdle()
    canSkip.value = false
    onFinish?.(result)
    emitLater()
  }
  const finish = () => settle('win')
  // Démarrage explicite : `immediate` de VueUse ne démarre que si `window` existe (rien dans les tests).
  const auto = useTimeoutFn(timed ? () => settle('fail') : finish, () => remaining, { immediate: false })
  const remainingNow = () => (resumedAt === null ? remaining : Math.max(0, remaining - (Date.now() - resumedAt)))
  // Temps de jeu écoulé depuis la fin de la grâce (ms) : la barre du HUD et sa valeur accessible s’y calent.
  const elapsed = () => Math.max(0, totalMs - remainingNow() - graceMs)
  // Grâce restante (ms) : la barre du HUD en tient compte quand une reprise tombe pendant la grâce.
  const graceLeft = () => Math.max(0, remainingNow() - (totalMs - graceMs))
  // Recalcule l’état de la minuterie : en marche seulement sans aucune raison de pause et avec l’onglet visible.
  const sync = () => {
    if (finished) return
    const mustPause = reasons.size > 0
    if (mustPause && resumedAt !== null) {
      remaining = remainingNow()
      resumedAt = null
      auto.stop()
    } else if (!mustPause && resumedAt === null) {
      resumedAt = Date.now()
      auto.start()
    }
    paused.value = mustPause
    // Pas de « Passer » pendant une pause (le compte d’inactivité repart à la reprise).
    if (mustPause) canSkip.value = false
  }
  const pause = (reason = MANUAL) => {
    reasons.add(reason)
    sync()
  }
  const resume = (reason = MANUAL) => {
    if (reasons.delete(reason)) sync()
  }
  // Pause automatique quand le document est caché.
  const visibility = useDocumentVisibility()
  watch(visibility, (v) => (v === 'hidden' ? pause(HIDDEN) : resume(HIDDEN)), { flush: 'sync', immediate: true })
  sync()
  // « Passer » dépanne qui reste bloqué : après `revealAt` sans interaction, il apparaît (qui joue ne le voit jamais, la réussite automatique arrive avant).
  // `pointermove` compte aussi : certaines activités se jouent au survol (suivre les feux follets), sans aucun clic.
  // Il tire des dizaines d’événements par seconde : le filtre limite les réarmements (au plus un tous les 250 ms, et le dernier événement d’une rafale réarme quand même après la fenêtre, jamais avant),
  // ce qui retarde l’apparition de « Passer » de 250 ms au plus. `idle` repasse à faux à la reprise d’activité : le verrou le garde affiché,
  // il ne doit pas fuir sous le doigt de qui veut l’atteindre. Pas de `window` (SSR, tests node) : aucune minuterie, jamais d’aide.
  // Pendant une pause, aucun « Passer » ; à la reprise le compte d’inactivité repart de zéro (une démonstration ne compte pas comme du blocage).
  const {
    idle,
    stop: stopIdle,
    reset: resetIdle,
  } = useIdle(revealAt + graceMs, {
    events: ['pointerdown', 'pointermove', 'keydown'],
    eventFilter: throttleFilter(POKE_THROTTLE_MS),
    listenForVisibilityChange: false,
  })
  watch(
    idle,
    (isIdle) => {
      if (isIdle && !finished && !paused.value) canSkip.value = true
    },
    { flush: 'sync' },
  )
  watch(paused, (p) => !p && !finished && resetIdle(), { flush: 'sync' })
  return { finish, canSkip, outcome, startedAt, paused, elapsed, graceLeft, pause, resume, isFinished: () => finished }
}
