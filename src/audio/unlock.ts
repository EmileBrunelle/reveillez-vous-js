import { useEventListener } from '@vueuse/core'
import { effectScope } from 'vue'

/** Vrai dès qu’un geste a eu lieu (drapeau de repli quand `navigator.userActivation` manque). */
let gestured = false
const pending = new Set<() => void>()

/** Vrai seulement si un geste a été vu (strict, sans repli permissif) : condition pour reprendre un contexte au retour de l’onglet. */
export const hasGestured = (): boolean => gestured || (typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === true)

/**
 * Vrai quand la page a reçu un geste d’activation : seul moment où Chrome laisse créer ou reprendre un AudioContext sans avertissement.
 * Sans `navigator.userActivation` (vieux moteurs, environnement de test), on ne peut pas savoir : on ne bloque pas, comportement d’avant.
 */
export const activated = (): boolean => {
  if (gestured) return true
  const ua = typeof navigator === 'undefined' ? undefined : navigator.userActivation
  return ua ? ua.hasBeenActive : true
}

/** Note un geste et lance les démarrages en attente (ambiance, piano). */
export const markGestured = () => {
  gestured = true
  const todo = [...pending]
  pending.clear()
  for (const cb of todo) cb()
}

let listening = false
/**
 * Exécute `cb` dès que l’audio peut démarrer : tout de suite si un geste a déjà eu lieu, sinon au premier geste.
 * Sert à l’ambiance et au piano demandés au montage, avant tout clic. Renvoie l’annulation.
 */
export const whenUnlocked = (cb: () => void): (() => void) => {
  if (activated()) {
    cb()
    return () => undefined
  }
  pending.add(cb)
  if (!listening && typeof window !== 'undefined') {
    listening = true
    // `pointerup` et `keydown` sont des gestes d’activation (le tactile n’active pas sur `pointerdown`).
    // Portée détachée : l’écoute survit au composant qui l’a demandée (sinon un décor démonté avant le premier geste l’emporterait,
    // et `listening` resterait vrai sans écouteur).
    effectScope(true).run(() => useEventListener(window, ['pointerup', 'keydown'], markGestured, { passive: true }))
  }
  return () => void pending.delete(cb)
}
