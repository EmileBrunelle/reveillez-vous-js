import { tryOnScopeDispose } from '@vueuse/core'
import { scheduleKnocks, type KnockHandle, type KnockHit } from '../audio/sfx'

/** Calendrier de coups (horloge Web Audio), un seul à la fois : un nouvel `schedule` annule le précédent ; `cancel()` et la destruction du scope l’annulent aussi. */
export const useKnockSchedule = () => {
  let handle: KnockHandle | null = null
  const cancel = () => {
    handle?.cancel()
    handle = null
  }
  /** `offsets` : décalages des coups en secondes ; `intensity` : force des coups ; `onHit` : appelé au moment où chaque coup s’entend. */
  const schedule = (offsets: number[], intensity: number, onHit: KnockHit): KnockHandle => {
    cancel()
    return (handle = scheduleKnocks(offsets, intensity, onHit))
  }
  tryOnScopeDispose(cancel)
  return { schedule, cancel }
}
