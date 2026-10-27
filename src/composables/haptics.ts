import { useDocumentVisibility, useVibrate } from '@vueuse/core'

/** Durée maximale d’une impulsion : courte, jamais de motif soutenu (WCAG 2.3.1, ≥ 3 Hz). */
export const MAX_PULSE_MS = 30
export const MIN_PULSE_MS = 10
/** Deux impulsions plus proches que cela ne s’empilent pas (rafale au retour d’un onglet caché). */
export const MIN_GAP_MS = 90

let last = -Infinity
/** Logique pure (sans DOM) : renvoie la durée bornée à jouer, ou null si la garde ou le limiteur refuse.
 * Le limiteur est au niveau du module : l’écart minimal est partagé entre tous les composants. */
export const planPulse = (ms: number, allowed: boolean, now: number = performance.now()): number | null => {
  if (!allowed || now - last < MIN_GAP_MS) return null
  last = now
  return Math.min(MAX_PULSE_MS, Math.max(MIN_PULSE_MS, ms))
}
export const resetPulseLimiter = () => {
  last = -Infinity
}

/** À appeler dans le setup d’un composant (useVibrate l’exige). Android seulement (iOS n’expose pas vibrate),
 * rien quand l’onglet est caché. Le son coupé ne bloque pas : le haptique aide justement le jeu muet (rythme de la porte).
 * Le haptique n’est pas du mouvement : « mouvement réduit » ne le bloque pas. */
export const useHaptics = () => {
  const { vibrate, isSupported } = useVibrate()
  const visibility = useDocumentVisibility()
  const pulse = (ms: number): boolean => {
    const duration = planPulse(ms, isSupported.value && visibility.value !== 'hidden')
    if (duration === null) return false
    vibrate(duration)
    return true
  }
  return { pulse }
}
