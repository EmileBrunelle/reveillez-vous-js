import { tryOnScopeDispose } from '@vueuse/core'
import { finishAnimations, type Stoppable } from './finishAnimations'

/** Garde les animations Motion lancées à la main : `finish()` les mène à leur fin (pas à mi-course) ; la destruction du scope le fait aussi. */
export const useKeptAnimations = () => {
  let running: Stoppable[] = []
  const settle = (a: Stoppable) => (running = running.filter((r) => r !== a))
  /** Retient `a` jusqu’à sa fin (réussie ou non) ; la liste ne grossit pas. */
  const keep = (a: Stoppable) => {
    running.push(a)
    void Promise.resolve(a).then(
      () => settle(a),
      () => undefined,
    )
  }
  const finish = () => {
    finishAnimations(running)
    running = []
  }
  tryOnScopeDispose(finish)
  return { keep, finish, pending: () => running.length }
}
