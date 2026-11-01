<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { M as Motion, animate, useMotionValue, useMotionValueEvent, usePresence, useSpring } from 'motion-v'
import { useElementSize, useEventListener } from '@vueuse/core'
import TarotCardBack from './TarotCardBack.vue'
import { DECK_BREATH_HZ, DECK_BREATH_TILT, DECK_BREATH_Y, DECK_LAYERS, DECK_PERSP, DECK_POINTER_TILT, DECK_THICK, DECK_TILT, STOW_END_SCALE, STOW_SCALE, deckPose } from './deckFan'
import { useReducedMotion } from '@/composables/useReducedMotion'

// Le paquet : un vrai objet posé au centre de la boîte des cartes, derrière l’éventail (DeckCut) et la lecture (TarotCard). Les trois cartes de la coupe sont les cartes de son dessus :
// elles en partent à la donne et y reviennent au rangement ; la carte de lecture y retourne à sa sortie. Il reste donc en place de la coupe jusqu’à la fin de la lecture.
// Volume : le dos du dessus (TarotCardBack, plan de pivot z = 0) et une tranche de DECK_LAYERS couches crème empilées vers l’arrière (translateZ), vue en perspective douce ;
// l’inclinaison fait apparaître la tranche en bas à droite. Les couches sont statiques : seul le transform du paquet bouge.
// La 3D reste DANS le paquet : l’enveloppe (`flat`, avec son propre transform et son opacité) en fait un contexte de rendu isolé ; les cartes de l’éventail, frères dans le DOM, ne s’y mêlent pas et leur z-index reste le seul ordre.
// Décoratif, sous les cartes (frère placé avant elles dans le DOM, dans la même cellule de grille : même centre que l’éventail et la lecture) ; jamais interactif.
// Vivant : respiration très lente (déplacement et inclinaison seulement), inclinaison douce qui suit le pointeur. Mouvement réduit : immobile, mais toujours en 3D.
const reduced = useReducedMotion()
const box = useTemplateRef<HTMLElement>('box')
const { width } = useElementSize(box, undefined, { box: 'border-box' })

const opacity = useMotionValue(0)
const scale = useMotionValue(STOW_SCALE)
const y = useMotionValue(0)
const rotateX = useMotionValue<number>(DECK_TILT.x)
const rotateY = useMotionValue<number>(DECK_TILT.y)
const perspective = useMotionValue(0)
const breath = useMotionValue(0) // −1..1, va-et-vient lent (Motion le pilote)
const px = useSpring(0, { stiffness: 60, damping: 14 }) // décalage du pointeur par rapport au centre de l’écran, −1..1 (ressort : l’inclinaison suit sans saccade)
const py = useSpring(0, { stiffness: 60, damping: 14 })

// UN seul endroit écrit le transform du paquet et la pose partagée avec les cartes en pile (deckPose).
const compose = () => {
  const b = breath.get()
  const rx = DECK_TILT.x + b * DECK_BREATH_TILT - py.get() * DECK_POINTER_TILT
  const ry = DECK_TILT.y + b * DECK_BREATH_TILT * 0.7 + px.get() * DECK_POINTER_TILT
  const dy = b * DECK_BREATH_Y
  rotateX.set(rx)
  rotateY.set(ry)
  y.set(dy * width.value)
  perspective.set(width.value * DECK_PERSP)
  deckPose.rx = rx
  deckPose.ry = ry
  deckPose.y = dy
}
useMotionValueEvent(breath, 'change', compose)
useMotionValueEvent(px, 'change', compose)
useMotionValueEvent(py, 'change', compose)
watch(width, compose)
const clamp = (v: number) => Math.max(-1, Math.min(1, v))
useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (reduced.value) return
  px.set(clamp((e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1))
  py.set(clamp((e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1))
})

// Tranche : couches pleines au contour sombre, de plus en plus profondes, en deux crèmes alternés (la tranche des cartes). Statiques, calculées une fois.
const layers = Array.from({ length: DECK_LAYERS }, (_, k) => ({
  background: k % 2 ? '#f0e4b8' : '#b89f66', // crème clair et carton plus sombre en alternance : la tranche se lit en bandes fines
  transform: `translateZ(calc(${-(((k + 1) * DECK_THICK) / DECK_LAYERS) * 100}cqw))`,
}))
const groundShadow = { transform: `translateZ(calc(${-(DECK_THICK + 0.03) * 100}cqw)) scale(1.08)` }

let wrapNode: HTMLElement | null = null
const setWrap = (c: unknown) => {
  const el = c instanceof Element ? c : ((c as { $el?: Element } | null)?.$el ?? null)
  if (el) wrapNode = el as HTMLElement
}
let breathing: ReturnType<typeof animate> | null = null
onMounted(() => {
  compose()
  if (reduced.value) return void animate(opacity, [0, 1], { duration: 0.25, ease: 'easeOut' })
  animate(opacity, 1, { duration: 0.2, ease: 'easeOut' })
  breathing = animate(breath, [-1, 1], { duration: 1 / (2 * DECK_BREATH_HZ), repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' })
})
onBeforeUnmount(() => {
  breathing?.stop()
  breathing = null
})
// Sortie : une fois la carte de lecture revenue sur le dessus, le paquet recule (il rétrécit) et s’efface. `animate` direct sur l’élément gardé :
// à ce moment le composant est démonté et ses valeurs Motion ne s’écrivent plus ; les durées sont bornées, la promesse se termine toujours.
usePresence({
  element: () => wrapNode,
  onExit: async () => {
    deckPose.rx = DECK_TILT.x
    deckPose.ry = DECK_TILT.y
    deckPose.y = 0
    const el = wrapNode
    if (!el) return
    if (reduced.value) return void (await animate(el, { opacity: 0 }, { duration: 0.2, ease: 'easeOut' }))
    void animate(el, { scale: STOW_END_SCALE }, { duration: 0.45, delay: 0.25, ease: [0.4, 0, 0.2, 1] })
    await animate(el, { opacity: 0 }, { duration: 0.3, delay: 0.4, ease: 'easeIn' })
  },
})
</script>

<template>
  <div ref="box" class="deckbox relative aspect-[7/12] col-start-1 row-start-1 pointer-events-none" aria-hidden="true">
    <Motion :ref="(c: unknown) => setWrap(c)" :style="{ y, scale, opacity }" class="deckbox__lift absolute top-1/2 left-1/2 w-[100cqw] will-change-transform">
      <Motion :style="{ transformPerspective: perspective, rotateX, rotateY }" class="relative aspect-[7/12] [transform-style:preserve-3d] will-change-transform">
        <span class="absolute inset-0 rounded-[4cqw] [background:rgb(5_8_24)] [filter:blur(3cqw)] opacity-60" :style="groundShadow"></span>
        <span v-for="(l, k) in layers" :key="k" class="absolute inset-0 rounded-[4cqw]" :style="l"></span>
        <span class="absolute inset-0"><TarotCardBack fill paquet="nuit" /></span>
      </Motion>
    </Motion>
  </div>
</template>

<style scoped>
/* Même boîte que .deck (DeckCut) et .tarot (TarotCard) : la largeur d’une carte, en cqw. */
.deckbox {
  width: min(100cqw, calc(100cqh * 7 / 12));
  container-type: inline-size;
}
.deckbox__lift {
  translate: -50% -50%;
}
</style>
