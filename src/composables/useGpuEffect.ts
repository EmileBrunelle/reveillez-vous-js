import { ref, watch, type Ref } from 'vue'
import { tryOnMounted, tryOnScopeDispose, useDocumentVisibility, useTimeoutFn } from '@vueuse/core'
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
  /** Visibilité du document ; injectable pour les tests (par défaut `useDocumentVisibility()`, créé dans le scope du composant). */
  visibility?: Readonly<Ref<'visible' | 'hidden' | string>>
}

/**
 * Cycle de vie d’un effet WebGPU sur un canevas : démarre au montage (porte, attente de mise en page, `start`), garde le démontage
 * pendant l’init asynchrone (la boucle tardive est arrêtée aussitôt) et arrête la boucle à la destruction du scope. Le composant n’a
 * ni drapeau ni `stop()`. `start` reçoit le canevas et un rappel `onLost` à passer à `startGpuLoop` ; `lost` passe à vrai à l’échec
 * de l’init comme à la perte du périphérique.
 */
export const useGpuEffect = (canvas: Readonly<Ref<HTMLCanvasElement | null>>, start: (canvas: HTMLCanvasElement, onLost: () => void) => Promise<GpuLoop>, options: GpuEffectOptions = {}) => {
  const { gate, timeout, warning = 'Effet GPU désactivé :', settle = nextFrame } = options
  // Onglet ouvert en arrière-plan : rAF est suspendu, une init bornée y échouerait pour de bon. On attend donc la visibilité AVANT la porte, la mise en page
  // et la borne : le délai ne commence qu’une fois l’onglet visible. Le `watch` vit dans le scope du composant (aucune fuite après la destruction).
  const visibility = options.visibility ?? useDocumentVisibility()
  const waiters: Array<() => void> = []
  watch(visibility, (v) => v === 'visible' && waiters.splice(0).forEach((r) => r()))
  const whenVisible = () => (visibility.value === 'visible' ? Promise.resolve() : new Promise<void>((resolve) => waiters.push(resolve)))
  let expired = false
  const status = ref<GpuStatus>('starting')
  const lost = ref(false)
  let gone = false
  let loop: GpuLoop | null = null
  // Borne `p` par `timeout` : rejette une Error à l’expiration ; la minuterie est annulée dès que `p` se termine (aucune minuterie qui traîne).
  const bounded = <T>(p: Promise<T>, label: string): Promise<T> => {
    if (!timeout) return p
    return new Promise<T>((resolve, reject) => {
      const { stop } = useTimeoutFn(() => reject(new Error(`${label} timed out`)), timeout)
      p.then(resolve, reject).finally(stop)
    })
  }

  tryOnScopeDispose(() => {
    gone = true
    loop?.stop()
    loop = null
  })
  tryOnMounted(async () => {
    await whenVisible()
    if (gone) return
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
    // L’attente de mise en page est DANS la borne : onglet masqué, rAF est suspendu et l’init échoue quand même après `timeout`.
    const run = settle().then(() => (gone || expired || !canvas.value ? null : start(canvas.value, () => (lost.value = true))))
    try {
      const s = await bounded(run, 'init')
      if (!s) return
      if (gone) return s.stop()
      loop = s
      status.value = 'ready'
    } catch (e) {
      expired = true // si l’attente de mise en page finit après l’expiration, `start` n’est même pas lancé
      console.warn(warning, e)
      lost.value = true
      void run.then(
        (s) => s?.stop(), // l’init finit après l’expiration : on libère le périphérique
        () => undefined,
      )
      if (!gone) status.value = 'failed'
    }
  })

  return { status, lost }
}
