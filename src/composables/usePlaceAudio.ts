import { tryOnMounted, tryOnScopeDispose } from '@vueuse/core'
import { startAmbience } from '../audio/ambience'
import { startMusic } from '../audio/music'
import type { PlaceId } from '../effects/places'

/** Ambiance du lieu et piano : démarrent au montage, s’arrêtent seuls à la destruction du scope. `level` est lu par les deux (paranoïa 1–5). */
export const usePlaceAudio = (place: () => PlaceId, level: () => number) => {
  let stopAmbience = () => {}
  let stopMusic = () => {}
  tryOnMounted(() => {
    stopAmbience = startAmbience(place(), level)
    stopMusic = startMusic(level)
  })
  tryOnScopeDispose(() => {
    stopAmbience()
    stopMusic()
  })
}
