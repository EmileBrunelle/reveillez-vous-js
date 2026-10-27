import { muted } from '../audio/sfx'

/** Durée maximale d’une impulsion : courte, jamais de motif soutenu (WCAG 2.3.1, ≥ 3 Hz). */
export const MAX_PULSE_MS = 30
export const MIN_PULSE_MS = 10
/** Deux impulsions plus proches que cela ne s’empilent pas (rafale au retour d’un onglet caché). */
export const MIN_GAP_MS = 90

type VibrateNav = { vibrate?: (pattern: number) => boolean }

const defaultNav = (): object | undefined => (typeof navigator === 'undefined' ? undefined : navigator)

/** Garde unique : Android seulement (iOS n’expose pas vibrate), et rien si le son est coupé. */
export const canVibrate = (nav: object | undefined = defaultNav(), isMuted: boolean = muted.value): boolean =>
  !isMuted && !!nav && 'vibrate' in nav && typeof (nav as VibrateNav).vibrate === 'function'

let last = -Infinity
/** Impulsion courte (10–30 ms), silencieuse si la garde refuse. `nav` et `now` sont injectables pour les tests. */
export const pulse = (ms: number, nav: object | undefined = defaultNav(), now: number = performance.now()): boolean => {
  if (!canVibrate(nav)) return false
  if (now - last < MIN_GAP_MS) return false
  last = now
  try {
    ;(nav as VibrateNav).vibrate!(Math.min(MAX_PULSE_MS, Math.max(MIN_PULSE_MS, ms)))
    return true
  } catch {
    return false
  }
}
export const resetPulseLimiter = () => {
  last = -Infinity
}
