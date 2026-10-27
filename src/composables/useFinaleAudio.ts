import { tryOnScopeDispose } from '@vueuse/core'
import { startFinaleAudio, type FinaleAudio } from '../audio/finale'

/** Sons de la finale : coupés en fondu à la destruction du scope (`stop` est idempotent, un arrêt anticipé par l’appelant reste permis). */
export const useFinaleAudio = (): FinaleAudio => {
  const audio = startFinaleAudio()
  tryOnScopeDispose(() => audio.stop())
  return audio
}
