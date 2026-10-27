import { ref, type Ref } from 'vue'
import { promiseTimeout, tryOnMounted, tryOnScopeDispose } from '@vueuse/core'
import type { GpuLoop } from '../effects/gpuLoop'
import { nextFrame } from './nextFrame'

/** `starting` : init en cours ; `ready` : la boucle tourne ; `failed` : l’init a échoué ou expiré (secours visuel) ; `unavailable` : pas de WebGPU (la porte `gate` a répondu non). */
export type GpuStatus = 'starting' | 'ready' | 'failed' | 'unavailable'

export interface GpuEffectOptions {
  /** Vérification préalable (ex. adaptateur WebGPU) ; faux, rejet ou expiration : état `unavailable`, rien n’est démarré. */
  gate?: () => Promise<boolean>
  /** Délai maximal (ms) de la porte et de l’init ; absent : pas de limite. */
  timeout?: number
  /** Message de console quand l’init échoue. */
  warning?: string
  /** Attente avant l’init, pour que le canevas soit mis en page (une image par défaut) ; injectable pour les tests. */
  settle?: () => Promise<void>
}

/**
 * Cycle de vie d’un effet WebGPU sur un canevas : démarre au montage (porte, attente de mise en page, `start`), garde le démontage
 * pendant l’init asynchrone (la boucle tardive est arrêtée aussitôt) et arrête la boucle à la destruction du scope. Le composant n’a
 * ni drapeau ni `stop()`. `start` reçoit le canevas et un rappel `onLost` à passer à `startGpuLoop` ; `lost` passe à vrai à l’échec
 * de l’init comme à la perte du périphérique.
 */
export const useGpuEffect = (canvas: Readonly<Ref<HTMLCanvasElement | null>>, start: (canvas: HTMLCanvasElement, onLost: () => void) => Promise<GpuLoop>, options: GpuEffectOptions = {}) => {
  const { gate, timeout, warning = 'Effet GPU désactivé :', settle = nextFrame } = options
  const status = ref<GpuStatus>('starting')
  const lost = ref(false)
  let gone = false
  let loop: GpuLoop | null = null
  const bounded = <T>(p: Promise<T>, label: string): Promise<T> => (timeout ? Promise.race([p, promiseTimeout(timeout, true, `${label} timed out`) as Promise<never>]) : p)

  tryOnScopeDispose(() => {
    gone = true
    loop?.stop()
    loop = null
  })
  tryOnMounted(async () => {
    if (gate) {
      let ok = false
      try {
        ok = await bounded(gate(), 'gate')
      } catch {
        ok = false
      }
      if (gone) return
      if (!ok) {
        status.value = 'unavailable'
        return
      }
    }
    await settle()
    if (gone || !canvas.value) return
    const run = start(canvas.value, () => (lost.value = true))
    try {
      const s = await bounded(run, 'init')
      if (gone) return s.stop()
      loop = s
      status.value = 'ready'
    } catch (e) {
      console.warn(warning, e)
      lost.value = true
      void run.then(
        (s) => s.stop(), // l’init finit après l’expiration : on libère le périphérique
        () => undefined,
      )
      if (!gone) status.value = 'failed'
    }
  })

  return { status, lost }
}
