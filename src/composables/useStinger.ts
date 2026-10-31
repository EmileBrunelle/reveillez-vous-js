import { watch } from 'vue'
import { tryOnScopeDispose } from '@vueuse/core'
import { muted } from '../audio/sfx'
import { playStinger } from '../audio/stinger'
import type { Outcome } from '../engine/activityTiming'

/** Jingle de fin d’activité, un seul à la fois : un nouveau `play` coupe le précédent ; coupé aussi à la destruction du scope et si le son passe en muet. */
export const useStinger = () => {
  let stop: (() => void) | null = null
  const cut = () => {
    stop?.()
    stop = null
  }
  /** `o` : issue de l’activité (choisit le jingle) ; `delay` : attente en secondes avant la première note. */
  const play = (o: Outcome, delay = 0): (() => void) => {
    cut()
    return (stop = playStinger(o, delay))
  }
  watch(muted, (m) => m && cut())
  tryOnScopeDispose(cut)
  return { play }
}
