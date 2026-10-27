import { animate } from 'motion-v'
import type { Ref } from 'vue'
import { useReducedMotion } from './useReducedMotion'

/** Secousse d’un impact (coup à la porte) sur l’élément donné, d’amplitude relative `amp` ; rien en mouvement réduit. */
export const useShake = (el: Readonly<Ref<HTMLElement | null>>) => {
  const reduced = useReducedMotion()
  return (amp: number) => {
    if (reduced.value || !el.value) return
    const a = 10 * amp
    animate(el.value, { x: [0, -a, a * 0.8, -a * 0.5, a * 0.3, 0], y: [0, a * 0.4, -a * 0.5, a * 0.2, 0] }, { duration: 0.35 })
  }
}
