import { tryOnMounted, tryOnScopeDispose } from '@vueuse/core'
import { startAmbience } from '../audio/ambience'
import type { PlaceId } from '../effects/places'

/** Ambiance du lieu et piano : démarrent au montage, s’arrêtent seuls à la destruction du scope. `level` est lu par les deux (paranoïa 1–5). */
export const usePlaceAudio = (place: () => PlaceId, level: () => number) => {
  let stopAmbience = () => {}
  let stopMusic = () => {}
  let disposed = false
  tryOnMounted(() => {
    stopAmbience = startAmbience(place(), level)
    // Le piano (partitions, voix additive) est un chunk à part : chargé après le premier rendu, hors du chunk d’entrée.
    import('../audio/music')
      .then(({ startMusic }) => {
        // Démonté avant la fin du chargement : on ne démarre rien (sinon le piano jouerait sans personne pour l’arrêter).
        if (!disposed) stopMusic = startMusic(level)
      })
      .catch(() => {}) // piano facultatif : un chunk introuvable (réseau coupé, déploiement en cours) ne doit rien casser
  })
  tryOnScopeDispose(() => {
    disposed = true
    stopAmbience()
    stopMusic()
  })
}
