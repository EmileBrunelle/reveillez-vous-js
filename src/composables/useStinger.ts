import { watch } from 'vue'
import { tryOnScopeDispose } from '@vueuse/core'
import { muted } from '../audio/sfx'
import { playStinger } from '../audio/stinger'
import type { Outcome } from '../engine/activityTiming'

/** Jingle de fin d’activité : coupé à la destruction du scope et si le son passe en muet pendant la lecture. */
export const useStinger = () => {
  let stop: () => void = () => {}
  /** `o` : issue de l’activité (choisit le jingle) ; `delay` : attente en secondes avant la première note. */
  const play = (o: Outcome, delay = 0): (() => void) => (stop = playStinger(o, delay))
  watch(muted, (m) => m && stop())
  tryOnScopeDispose(() => stop())
  return { play }
}
