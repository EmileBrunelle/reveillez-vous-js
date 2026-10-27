import { effectScope, getCurrentScope, onScopeDispose, type EffectScope } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import { animate, type AnimationOptions, type AnimationPlaybackControls, type DOMKeyframesDefinition } from 'motion-v'

type Target = Element | NodeListOf<Element> | undefined | null
type Animate = (el: Element | NodeListOf<Element>, keyframes: DOMKeyframesDefinition, options?: AnimationOptions) => AnimationPlaybackControls

/**
 * Colle Vue autour de `animate` de Motion : garde les contrôles des animations en cours et des attentes (`wait`, une `useTimeoutFn`
 * par attente, dans un sous-scope), et les arrête toutes à `halt()` ou à la destruction du scope. Les animations terminées sont retirées
 * au fur et à mesure (la liste ne grossit pas au fil d’une longue visite). `animateFn` est injectable pour les tests.
 *
 * Note : `stop()` de Motion annule l’animation sans résoudre sa promesse (vérifié dans motion-dom : seul `finish()` notifie la fin).
 * Après `halt()`, une promesse de `go` ou de `wait` interrompue reste donc en suspens, et la chaîne qui l’attendait s’arrête là.
 */
export const useMotionScope = (animateFn: Animate = animate) => {
  const parent: EffectScope = getCurrentScope() ?? effectScope(true)
  const running = new Set<AnimationPlaybackControls>()
  const waits = new Set<EffectScope>()
  let disposed = false

  /** Anime `el` ; la promesse rendue se résout à la fin et ne rejette jamais. Sans cible, ou après la destruction : rien à faire. */
  const go = (el: Target, keyframes: DOMKeyframesDefinition, options?: AnimationOptions) => {
    if (!el || disposed) return Promise.resolve()
    const controls = animateFn(el, keyframes, options)
    running.add(controls)
    return Promise.resolve(controls)
      .catch(() => undefined)
      .finally(() => running.delete(controls))
  }
  /** Applique tout de suite l’état final (durée 0). */
  const snap = (el: Target, keyframes: DOMKeyframesDefinition) => go(el, keyframes, { duration: 0 })
  /** Pause annulable : `halt()` l’annule (la promesse reste alors en suspens). Après la destruction, elle ne se résout jamais. */
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      if (disposed) return
      const timer = parent.run(() => effectScope())! // sous-scope : l’arrêter annule la minuterie et libère son entrée
      waits.add(timer)
      timer.run(() =>
        useTimeoutFn(() => {
          waits.delete(timer)
          timer.stop()
          resolve()
        }, ms),
      )
    })
  /** Arrête les animations en cours et annule les attentes. */
  const halt = () => {
    waits.forEach((w) => w.stop())
    waits.clear()
    running.forEach((c) => c.stop())
    running.clear()
  }
  onScopeDispose(() => {
    disposed = true
    halt()
  })

  return { go, snap, wait, halt, pending: () => running.size + waits.size }
}
