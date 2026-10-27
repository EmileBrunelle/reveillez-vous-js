import { tryOnScopeDispose } from '@vueuse/core'
import { scheduleKnocks, type KnockHandle } from '../audio/sfx'

/** Calendrier de coups (horloge Web Audio) : `cancel()` l’annule ; la destruction du scope aussi. Un nouvel `schedule` ne remplace pas le précédent (comme `scheduleKnocks`). */
export const useKnockSchedule = () => {
  let handle: KnockHandle | null = null
  const schedule = (...args: Parameters<typeof scheduleKnocks>) => (handle = scheduleKnocks(...args))
  const cancel = () => handle?.cancel()
  tryOnScopeDispose(cancel)
  return { schedule, cancel }
}
