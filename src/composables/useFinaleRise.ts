import type { Directive, Ref } from 'vue'
import { animate } from 'motion-v'
import { finishAnimations, type Stoppable } from './finishAnimations'

type Flags = { reduced: Readonly<Ref<boolean>>; skipped: Readonly<Ref<boolean>> }

/**
 * Directive `v-rise` : l’élément monte sur un ressort (opacité et y), après `d` secondes ; statique d’emblée en mouvement réduit ou après un saut.
 * Un hook de directive est l’endroit prévu par Vue pour toucher le DOM : l’état initial invisible doit précéder le premier rendu (pas de flash avant le ressort).
 * `keep` reçoit chaque animation (pour les mener à leur fin au saut ou à la destruction).
 */
export const useRiseDirective = ({ reduced, skipped }: Flags, keep: (a: Stoppable) => void) => {
  const vRise: Directive<HTMLElement, { d?: number; y?: number; letter?: boolean; soft?: boolean }> = {
    beforeMount(el) {
      if (!reduced.value && !skipped.value) el.style.opacity = '0'
    },
    mounted(el, { value }) {
      if (reduced.value || skipped.value) return
      const y = value.y ?? 16
      const spring = value.letter ? { stiffness: 240, damping: 15 } : value.soft ? { stiffness: 36, damping: 13 } : { stiffness: 80, damping: 17 }
      keep(animate(el, { opacity: [0, 1], ...(y ? { y: [y, 0] } : {}) } as never, { type: 'spring', ...spring, delay: value.d ?? 0 } as never))
    },
  }
  return vRise
}

/** Fondu de sortie du texte (hook `@leave` d’une `<Transition :css="false">`) ; `finishLeaving()` le mène à sa fin tout de suite (le générique apparaît sans attendre). */
export const useTextLeave = ({ reduced, skipped }: Flags) => {
  let leaving: (() => void) | undefined
  const leaveText = (el: Element, done: () => void) => {
    if (reduced.value || skipped.value) return done()
    const a = animate(el as HTMLElement, { opacity: 0 } as never, { duration: 0.45, ease: 'easeIn' } as never)
    const end = () => {
      leaving = undefined
      done()
    }
    leaving = () => {
      finishAnimations([a])
      end()
    }
    void Promise.resolve(a).then(end, end)
  }
  return { leaveText, finishLeaving: () => leaving?.() }
}
