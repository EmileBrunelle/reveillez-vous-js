import { tryOnScopeDispose } from '@vueuse/core'
import { startWipeSound, type WipeSound } from '../audio/wipe'

/** Son de frottement : créé au premier `move` (geste de l’utilisateur), coupé par `stop()` et à la destruction du scope. */
export const useWipeSound = () => {
  let wipe: WipeSound | null = null
  const move = (dist: number) => (wipe ??= startWipeSound()).move(dist)
  const rest = () => wipe?.rest()
  const stop = () => {
    wipe?.stop()
    wipe = null
  }
  tryOnScopeDispose(stop)
  return { move, rest, stop }
}
