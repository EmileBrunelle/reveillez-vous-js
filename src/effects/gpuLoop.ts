import { effectScope, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useDocumentVisibility } from '@vueuse/core'
import { clock, frameLoop, init, type Clock, type Frame, type FrameLoopHandle, type Gpu } from 'vgpu'

export interface GpuLoopOptions<S> {
  /** Crée surface et effets (appelé une fois, dans l’étendue de la boucle : les composables VueUse y sont nettoyés à l’arrêt). */
  setup: (gpu: Gpu) => S
  /** Encode une trame (`frame.pass(...)`). Ne rien encoder = trame sautée (rendu à la demande). */
  render: (frame: Frame, state: S, clock: Clock) => void
  /** Libère ce que `setup` a créé (effets). Le périphérique est libéré ensuite ; les erreurs des deux sont ignorées. */
  teardown?: (state: S) => void
  /** Plafond d’images par seconde, appliqué par `frameLoop` de vgpu (30 par défaut) ; un changement relance la boucle. */
  fps?: MaybeRefOrGetter<number>
  /** Pause supplémentaire (ex. CRT éteint) ; l’onglet caché met déjà la boucle en pause. */
  paused?: MaybeRefOrGetter<boolean>
  /** Périphérique perdu (ou trame en échec) hors arrêt volontaire : la boucle est déjà arrêtée. */
  onLost?: () => void
}

export interface GpuLoop {
  /** Idempotent : arrête la boucle puis libère effets et périphérique sans jamais lever. */
  stop(): void
}

/**
 * Colle Vue autour de vgpu pour les effets WebGPU : `init`, `frameLoop` (qui fournit le plafond de fps et l’arrêt
 * à `gpu.dispose()`), pause quand l’onglet est caché ou que `paused` est vrai, arrêt de la boucle à la perte du
 * périphérique, `stop` gardé. vgpu ne fournit pas la pause (on arrête et relance la boucle) ni de rappel de perte
 * (seulement la promesse `gpu.lost`).
 * Lève si `init` ou `setup` échoue (le périphérique est alors déjà libéré).
 * Appelé après des `await` (hors instance du composant), le helper crée sa propre étendue :
 * le composant appelant doit appeler `stop()` à son démontage.
 */
export const startGpuLoop = async <S>(opts: GpuLoopOptions<S>): Promise<GpuLoop> => {
  const { setup, render, teardown, fps = 30, paused, onLost } = opts
  const fpsNow = () => toValue(fps)
  const gpu = await init()
  const scope = effectScope(true)
  let stopped = false
  let state: S
  let time: Clock
  try {
    ;[state, time] = scope.run(() => [setup(gpu), clock(gpu)] as const)!
  } catch (e) {
    scope.stop()
    gpu.dispose()
    throw e
  }

  let loop: FrameLoopHandle | null = null
  const halt = () => {
    scope.stop() // arrête aussi le watch de pause : la boucle ne repartira pas
    try {
      loop?.stop()
    } catch {
      /* périphérique déjà perdu */
    }
    loop = null
  }
  // Perte du périphérique ou trame en échec : on arrête la boucle, la libération reste à `stop`.
  let lostFired = false
  const lose = () => {
    if (stopped || lostFired) return // une trame en échec puis `gpu.lost` ne préviennent qu’une fois
    lostFired = true
    halt()
    onLost?.()
  }
  const start = () =>
    frameLoop(
      gpu,
      (f) => {
        try {
          render(f, state, time)
        } catch (e) {
          console.error('Trame GPU en échec, boucle arrêtée :', e)
          lose()
        }
      },
      { fps: fpsNow() },
    )

  scope.run(() => {
    const visibility = useDocumentVisibility()
    // Une seule boucle vivante : tout changement (pause, reprise, cadence) arrête l’ancienne avant d’en lancer une.
    watch(
      [() => visibility.value === 'hidden' || !!toValue(paused), fpsNow],
      ([pause]) => {
        loop?.stop()
        loop = pause ? null : start()
      },
      { immediate: true },
    )
  })
  void gpu.lost.then(lose)

  return {
    stop() {
      if (stopped) return
      stopped = true
      halt()
      // Périphérique déjà perdu ou détruit : un dispose ne doit pas lever pendant le démontage.
      try {
        teardown?.(state)
      } catch {
        /* rien */
      }
      try {
        gpu.dispose()
      } catch {
        /* rien */
      }
    },
  }
}
