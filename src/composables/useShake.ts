import { animate } from 'motion-v'
import type { Ref } from 'vue'
import { useReducedMotion } from './useReducedMotion'

/**
 * Secousse d’un impact (coup à la porte) sur l’élément donné, d’amplitude relative `amp` ; rien en mouvement réduit.
 * `rotate` ajoute un léger roulis amorti (≈ 0,6° par unité d’amplitude) : c’est lui qui donne la sensation d’un choc.
 * À éviter sur un élément pleine largeur collé aux bords (barre des tâches) : la rotation y découvrirait les coins.
 */
export const useShake = (el: Readonly<Ref<HTMLElement | null>>, { rotate = false } = {}) => {
  const reduced = useReducedMotion()
  return (amp: number) => {
    if (reduced.value || !el.value) return
    const a = 10 * amp
    const r = 0.6 * amp
    animate(
      el.value,
      {
        x: [0, -a, a * 0.8, -a * 0.5, a * 0.3, 0],
        y: [0, a * 0.4, -a * 0.5, a * 0.2, 0],
        ...(rotate ? { rotate: [0, -r, r * 0.7, -r * 0.4, r * 0.15, 0] } : {}),
      },
      { duration: 0.35 },
    )
  }
}
