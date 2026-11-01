import { useDocumentVisibility, useTimeoutFn, useWindowFocus } from '@vueuse/core'
import { getCurrentInstance, getCurrentScope, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import { ACTIVITY_GRACE_MS, OUTCOME_MS, type Outcome, type Phase } from '@/engine/activityTiming'
import { useOverlayStore } from '@/stores/overlay'

// Délai de réussite automatique : une activité se réussit toujours, même sans y toucher.
export const AUTO_SUCCESS_MS = 20_000

// Raison de pause par défaut quand l’appelant n’en donne pas.
const MANUAL = 'manuel'
// Raison de pause posée tant que l’onglet est caché (une notification ne doit pas faire échouer).
const HIDDEN = 'onglet caché'
// Raison de pause posée quand la fenêtre perd le focus : levée seulement par `resumeAway` (bouton « Reprendre »), jamais au retour du focus,
// pour laisser à la personne le temps de se préparer.
const AWAY = 'absent'
// Raison de pause posée tant qu’un menu ou une fenêtre de l’application est ouvert (store des superpositions) : levée seule à la fermeture,
// sans voile ni « Reprendre » (la personne vient de fermer elle-même ce qu’elle avait ouvert).
const MENU = 'menu ouvert'
// Raison de pause posée par le bouton Pause (ou la touche P / Échap) : même voile et même « Reprendre » que l’absence.
const PLAYER = 'joueur'

// Contrôleur de l’absence, fourni au HUD (sans toucher aux activités) : `away` = la pause « absent » est active, `resumeAway` la lève.
export type AwayController = { away: Readonly<Ref<boolean>>; resumeAway: () => void; pauseByPlayer?: () => void }
export const AWAY_KEY: InjectionKey<AwayController> = Symbol('activity-away')

// Fin d’activité commune : `finish` n’émet qu’une fois (réussite du joueur ou minuterie, le premier gagne)
// `onFinish` s’exécute à cette fin, quel qu’en soit le chemin (réussite ou minuterie), et `done` attend `delayMs` pour laisser l’animation de réussite se jouer. Les minuteries meurent avec le composant.
export const useActivityDone = (
  emit: () => void,
  { autoMs = AUTO_SUCCESS_MS, delayMs, durationMs, onFinish }: { autoMs?: number; delayMs?: number; durationMs?: number; onFinish?: (o: Outcome) => void } = {},
) => {
  // Avec `durationMs` (activité chronométrée), la fin du temps est un échec (`outcome` = 'fail') suivi de la même suite que la réussite ;
  // sans lui, la minuterie `autoMs` reste une réussite automatique. `outcome` passe de 'play' à 'win' ou 'fail', une seule fois.
  const timed = durationMs !== undefined
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
  const { start: emitLater } = useTimeoutFn(emit, delayMs ?? (timed ? OUTCOME_MS : 900), { immediate: false })
  const settle = (result: Outcome) => {
    if (finished) return
    finished = true
    outcome.value = result
    auto.stop()
    remaining = remainingNow()
    resumedAt = null
    onFinish?.(result)
    emitLater()
  }
  const finish = () => settle('win')
  // Échec voulu par l’activité (essais épuisés) : même fin que l’expiration du temps, sans attendre la minuterie.
  const fail = () => settle('fail')
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
  }
  const away = ref(false)
  // `halted` = pause subie (onglet caché, fenêtre quittée ou menu ouvert), à l’exclusion des pauses voulues par l’activité (ex. démonstration) :
  // c’est elle que les minuteries de jeu doivent respecter.
  const halted = ref(false)
  const refreshReasons = () => {
    away.value = reasons.has(AWAY) || reasons.has(PLAYER)
    halted.value = away.value || reasons.has(HIDDEN) || reasons.has(MENU)
    sync()
  }
  const pause = (reason = MANUAL) => {
    reasons.add(reason)
    refreshReasons()
  }
  const resume = (reason = MANUAL) => {
    if (!reasons.delete(reason)) return
    refreshReasons()
  }
  // Pause automatique quand le document est caché.
  const visibility = useDocumentVisibility()
  watch(visibility, (v) => (v === 'hidden' ? pause(HIDDEN) : resume(HIDDEN)), { flush: 'sync', immediate: true })
  // Pause aussi quand la fenêtre perd le focus (clic dans une autre application, onglet toujours visible) : le temps ne file pas
  // pendant qu’on ne joue pas. Au retour du focus, pas de reprise automatique : `resumeAway` (bouton du HUD) la décide.
  // Vérifié dès le départ (`immediate`) : une activité démarre toujours après un clic, donc une fenêtre sans focus à ce moment
  // veut dire qu’on l’a quittée pendant la transition (fondu, chargement du morceau) ; l’activité démarre alors en pause.
  const focused = useWindowFocus()
  watch(focused, (f) => !f && pause(AWAY), { flush: 'sync', immediate: true })
  // Un seul geste lève toutes les pauses du voile (absence et pause voulue) : une seule confirmation suffit.
  const resumeAway = () => {
    const had = reasons.delete(AWAY)
    if (reasons.delete(PLAYER) || had) refreshReasons()
  }
  const pauseByPlayer = () => pause(PLAYER)
  // Pause aussi tant qu’un menu ou une fenêtre de l’application est ouvert (Démarrer, Son, Collection, À propos, confirmation) :
  // reprise automatique à la fermeture, sauf si la fenêtre a aussi été quittée (`away` attend alors toujours « Reprendre »).
  const overlay = useOverlayStore()
  watch(
    () => overlay.active,
    (a) => (a ? pause(MENU) : resume(MENU)),
    { flush: 'sync', immediate: true },
  )
  // Hors composant (tests de la logique seule), `provide` n’a pas de sens : le HUD retombe alors sur son repli inerte.
  if (getCurrentInstance()) provide(AWAY_KEY, { away, resumeAway, pauseByPlayer })
  sync()
  // Exécute `fn` tout de suite hors pause ; en pause (`halted`, pas la démonstration d’une activité), une seule fois à la reprise (ignoré si l’activité est finie entre-temps).
  // Sert aux minuteries de jeu qui ne doivent pas agir derrière le voile « EN PAUSE ».
  // L’attente est rattachée à la portée de l’activité (appel depuis une minuterie = hors composant) : démontée pendant la pause, elle disparaît avec elle.
  const scope = getCurrentScope()
  const afterPause = (fn: () => void) => {
    if (!halted.value) return fn()
    const wait = () =>
      watch(
        halted,
        () => {
          if (!finished) fn()
        },
        { flush: 'sync', once: true },
      )
    if (scope) scope.run(wait)
    else wait()
  }
  return { finish, fail, outcome, startedAt, paused, elapsed, graceLeft, pause, resume, away, halted, resumeAway, afterPause, isFinished: () => finished }
}
