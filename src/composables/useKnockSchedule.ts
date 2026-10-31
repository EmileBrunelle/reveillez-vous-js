import { tryOnScopeDispose } from '@vueuse/core'
import { scheduleKnocks, type KnockHandle, type KnockHit } from '../audio/sfx'

/** Calendrier de coups (horloge Web Audio) : `cancel()` l’annule ; la destruction du scope aussi. Un nouvel `schedule` ne remplace pas le précédent (comme `scheduleKnocks`). */
export const useKnockSchedule = () => {
  let handle: KnockHandle | null = null
  /** `offsets` : décalages des coups en secondes ; `intensity` : force des coups ; `onHit` : appelé au moment où chaque coup s’entend. */
  const schedule = (offsets: number[], intensity: number, onHit: KnockHit): KnockHandle => (handle = scheduleKnocks(offsets, intensity, onHit))
  const cancel = () => handle?.cancel()
  tryOnScopeDispose(cancel)
  return { schedule, cancel }
}
