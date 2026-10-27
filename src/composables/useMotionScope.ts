import { onScopeDispose } from 'vue'
import { animate } from 'motion-v'

type Target = Element | NodeListOf<Element> | undefined | null
type Controls = { stop: () => void } & PromiseLike<unknown>
type Animate = (el: never, keyframes: never, options: never) => Controls

/**
 * Colle Vue autour de `animate` de Motion : garde les contrôles des animations en cours et des attentes (`wait`),
 * et les arrête toutes à `halt()` ou à la destruction du scope. Les animations terminées sont retirées au fur et à mesure
 * (la liste ne grossit pas au fil d’une longue visite). `animateFn` est injectable pour les tests.
 */
export const useMotionScope = (animateFn: Animate = animate as unknown as Animate) => {
  const running = new Set<{ stop: () => void }>()
  const timers = new Set<ReturnType<typeof setTimeout>>()

  /** Anime `el` ; la promesse rendue se résout à la fin (ou à l’arrêt) et ne rejette jamais. Cible absente : rien à faire. */
  const go = (el: Target, keyframes: Record<string, unknown>, options: Record<string, unknown> = {}) => {
    if (!el) return Promise.resolve()
    const controls = animateFn(el as never, keyframes as never, options as never)
    running.add(controls)
    return Promise.resolve(controls)
      .catch(() => undefined)
      .finally(() => running.delete(controls))
  }
  /** Applique tout de suite l’état final (durée 0). */
  const snap = (el: Target, keyframes: Record<string, unknown>) => go(el, keyframes, { duration: 0 })
  /** Pause annulable : `halt()` l’annule (la promesse reste alors en suspens, comme les animations qu’on interrompt). */
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = setTimeout(() => {
        timers.delete(id)
        resolve()
      }, ms)
      timers.add(id)
    })
  /** Arrête les animations en cours et annule les attentes. */
  const halt = () => {
    timers.forEach(clearTimeout)
    timers.clear()
    running.forEach((c) => c.stop())
    running.clear()
  }
  onScopeDispose(halt)

  return { go, snap, wait, halt, pending: () => running.size + timers.size }
}
