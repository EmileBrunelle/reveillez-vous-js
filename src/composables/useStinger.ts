import { watch } from 'vue'
import { tryOnScopeDispose } from '@vueuse/core'
import { muted } from '../audio/sfx'
import { playStinger } from '../audio/stinger'

/** Jingle de fin d’activité : coupé à la destruction du scope et si le son passe en muet pendant la lecture. */
export const useStinger = () => {
  let stop: () => void = () => {}
  const play = (...args: Parameters<typeof playStinger>) => (stop = playStinger(...args))
  watch(muted, (m) => m && stop())
  tryOnScopeDispose(() => stop())
  return { play }
}
