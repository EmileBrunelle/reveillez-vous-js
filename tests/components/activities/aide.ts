// Aides communes aux tests des activités (fausses horloges, focus, mesures de la scène).
import { vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'

// Fausses horloges (installées par `horlogeGlobale`) : `Date`, minuteries et `requestAnimationFrame` avancent ensemble (les boucles `useRafFn` tournent par images de 16 ms).
export const horloge = () => {
  vi.clearAllTimers()
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
}

// Avance le temps par images de 16 ms (les boucles d’animation voient des deltas réalistes).
export const avancer = async (ms: number, pas = 16) => {
  let reste = ms
  while (reste > 0) {
    const d = Math.min(pas, reste)
    await vi.advanceTimersByTimeAsync(d)
    reste -= d
  }
}

// Rectangle de mesure fixe (happy-dom ne fait aucune mise en page).
export const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

export const fenetrePerdFocus = () => window.dispatchEvent(new Event('blur'))
export const fenetreRetrouveFocus = () => window.dispatchEvent(new Event('focus'))

export const reprendre = async (w: VueWrapper) => {
  const bouton = w.findAll('button').find((b) => b.text() === 'Reprendre')
  if (!bouton) throw new Error('bouton « Reprendre » absent')
  await bouton.trigger('click')
}

export const evenementPointeur = (type: string, init: { clientX: number; clientY: number; pointerType?: string; buttons?: number; pointerId?: number }) => {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>
  Object.assign(e, { pointerType: 'mouse', buttons: 0, pointerId: 1, ...init })
  return e
}

// Préférence « mouvement réduit » : à appeler avant le montage (VueUse lit `matchMedia`).
export const mouvementReduit = (actif: boolean) => {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q: string) =>
      ({
        matches: actif && q.includes('prefers-reduced-motion') && q.includes('reduce') && !q.includes('no-preference'),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

// Position (centre) d’un élément Motion lue sur son `transform: translateX(..) translateY(..)`.
export const positionMotion = (el: Element, demi = 0) => {
  const m = /translateX\((-?[\d.]+)px\) translateY\((-?[\d.]+)px\)/.exec(el.getAttribute('style') ?? '')
  return m ? { x: Number(m[1]) + demi, y: Number(m[2]) + demi } : null
}
