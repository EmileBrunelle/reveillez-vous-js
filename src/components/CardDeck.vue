<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { M as Motion, animate, useMotionValue, useMotionValueEvent, usePresence, useSpring } from 'motion-v'
import { useElementSize, useEventListener } from '@vueuse/core'
import TarotCardBack from './TarotCardBack.vue'
import { DECK_BREATH_HZ, DECK_BREATH_TILT, DECK_BREATH_Y, DECK_LAYERS, DECK_PERSP, DECK_POINTER_TILT, DECK_THICK, DECK_TILT, STOW_SCALE, deckPose } from './deckFan'
import { INSERT_COVER_OFF_MS, INSERT_END_SCALE, INSERT_FADE_IN_MS, INSERT_MS, INSERT_TOTAL_MS, deckSlot, pickSlot } from './deckInsert'
import { deckShown } from './deckShown'
import { useReducedMotion } from '@/composables/useReducedMotion'

// Le paquet : un vrai objet posé au centre de la boîte des cartes, derrière l’éventail (DeckCut) et la lecture (TarotCard). Les trois cartes de la coupe sont les cartes de son dessus :
// elles en partent à la donne et y reviennent au rangement ; la carte de lecture y retourne à sa sortie. Il reste donc en place de la coupe jusqu’à la fin de la lecture.
// Volume : le dos du dessus (TarotCardBack, plan de pivot z = 0) et une tranche de DECK_LAYERS couches crème empilées vers l’arrière (translateZ), vue en perspective douce ;
// l’inclinaison fait apparaître la tranche en bas à droite. Les couches sont statiques : seul le transform du paquet bouge.
// La 3D reste DANS le paquet : l’enveloppe (`flat`, avec son propre transform et son opacité) en fait un contexte de rendu isolé ; les cartes de l’éventail, frères dans le DOM, ne s’y mêlent pas et leur z-index reste le seul ordre.
// Décoratif, sous les cartes (frère placé avant elles dans le DOM, dans la même cellule de grille : même centre que l’éventail et la lecture) ; jamais interactif.
// Visible seulement quand il est le sujet (`deckShown`, écrit par DeckCut) : à la donne et au rangement ; caché le reste du temps, pour qu’on n’essaie pas de cliquer sur quelque chose d’inerte.
// Vivant : respiration très lente (déplacement et inclinaison seulement, seulement tant qu’il se voit), inclinaison douce qui suit le pointeur. Mouvement réduit : jamais affiché (les cartes se fondent sur place).
// Remise de la carte de lecture (sortie) : elle se place à côté du paquet, puis glisse DANS la tranche, à un rang tiré au hasard (voir deckInsert). Les couches du paquet sont dans un contexte 3D isolé : on ne peut
// pas y glisser la carte par z-index. Un deuxième élément racine, la COUCHE DE RECOUVREMENT (`deckcover`), est donc une copie fixe du dessus du paquet (dos + couches au-dessus du rang visé), partageant les mêmes valeurs
// Motion (même position, même inclinaison) et rendue PAR-DESSUS la carte (z-10, jamais animé) : éteinte, puis allumée quand la carte est séparée du paquet, éteinte une fois la carte fondue. Identique au paquet dessous : invisible.
const reduced = useReducedMotion()
const box = useTemplateRef<HTMLElement>('box')
const { width } = useElementSize(box, undefined, { box: 'border-box' })

// Rang visé par la carte de lecture à sa sortie, tiré une fois par paquet (cosmétique : `Math.random` suffit) ; TarotCard le lit dans `deckSlot`.
const slot = pickSlot(Math.random())
deckSlot.value = slot
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
  if (reduced.value || !deckShown.value) return
  px.set(clamp((e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1))
  py.set(clamp((e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1))
})

// Tranche : couches pleines au contour sombre, de plus en plus profondes, en deux crèmes alternés (la tranche des cartes). Statiques, calculées une fois.
const layers = Array.from({ length: DECK_LAYERS }, (_, k) => ({
  background: k % 2 ? '#f0e4b8' : '#b89f66', // crème clair et carton plus sombre en alternance : la tranche se lit en bandes fines
  transform: `translateZ(calc(${-(((k + 1) * DECK_THICK) / DECK_LAYERS) * 100}cqw))`,
}))
const groundShadow = { transform: `translateZ(calc(${-(DECK_THICK + 0.03) * 100}cqw)) scale(1.08)` }
const coverLayers = layers.slice(0, slot) // les couches AU-DESSUS du rang visé : la carte glisse sous elles

let wrapNode: HTMLElement | null = null
let coverNode: HTMLElement | null = null
const elOf = (c: unknown) => (c instanceof Element ? c : ((c as { $el?: Element } | null)?.$el ?? null)) as HTMLElement | null
const setWrap = (c: unknown) => (wrapNode = elOf(c) ?? wrapNode)
const setCover = (c: unknown) => (coverNode = elOf(c) ?? coverNode)
let breathing: ReturnType<typeof animate> | null = null
let fade: ReturnType<typeof animate> | null = null
const startBreath = () => {
  breathing ??= animate(breath, [-1, 1], { duration: 1 / (2 * DECK_BREATH_HZ), repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' })
}
const stopBreath = () => {
  breathing?.stop()
  breathing = null
}
// Apparition et effacement : le paquet respire seulement tant qu’il se voit (aucun travail pour un élément caché). Mouvement réduit : jamais affiché.
const show = () => {
  if (reduced.value) return
  fade?.stop()
  startBreath()
  fade = animate(opacity, 1, { duration: 0.2, ease: 'easeOut' })
}
const hide = () => {
  if (reduced.value) return
  fade?.stop()
  const out = animate(opacity, 0, { duration: 0.22, ease: 'easeIn' })
  fade = out
  void out.then(() => !deckShown.value && stopBreath())
}
watch(deckShown, (on) => (on ? show() : hide()))
onMounted(() => {
  compose()
  if (deckShown.value) show()
})
onBeforeUnmount(() => {
  fade?.stop()
  stopBreath()
})
// Sortie : le paquet apparaît derrière la carte de lecture (qui le couvre encore), la carte s’y glisse (voir deckInsert), puis il recule et s’efface. `animate` direct sur les éléments gardés :
// à ce moment le composant est démonté et ses valeurs Motion ne s’écrivent plus. Chaque élément n’a qu’UNE animation à images clés (pas de retard + remplissage qui s’écraseraient), de durée bornée :
// la promesse se termine toujours. Mouvement réduit : le paquet reste caché, la carte se fond seule (TarotCard).
usePresence({
  element: () => wrapNode,
  onExit: async () => {
    const el = wrapNode
    const cover = coverNode
    if (!el || reduced.value || !cover) return
    const T = INSERT_TOTAL_MS / 1000
    const at = (ms: number) => ms / INSERT_TOTAL_MS
    // La couche s’allume dès que la carte est séparée du paquet, et s’éteint d’un coup une fois la carte fondue (jamais en fondu avec le paquet : deux couches opaques superposées épaissiraient le fondu).
    // Rampe d’une image : la couche est identique au paquet dessous, elle est invisible.
    const frame = 16
    const coverEnd = INSERT_COVER_OFF_MS + frame
    void animate(
      cover,
      { opacity: [0, 0, 1, 1, 0] },
      { duration: coverEnd / 1000, times: [0, INSERT_MS.approach / coverEnd, (INSERT_MS.approach + frame) / coverEnd, INSERT_COVER_OFF_MS / coverEnd, 1], ease: 'linear' },
    )
    await animate(
      el,
      { opacity: [null, 1, 1, 0], scale: [null, STOW_SCALE, STOW_SCALE, INSERT_END_SCALE] },
      { duration: T, times: [0, at(INSERT_FADE_IN_MS), at(INSERT_COVER_OFF_MS), 1], ease: ['easeOut', 'linear', [0.4, 0, 0.2, 1]] },
    )
    deckPose.rx = DECK_TILT.x // la prochaine donne repart du repos
    deckPose.ry = DECK_TILT.y
    deckPose.y = 0
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
  <!-- Couche de recouvrement : copie fixe du dessus du paquet (dos + couches au-dessus du rang visé), mêmes valeurs Motion donc même pose, PAR-DESSUS la carte de lecture (z-10 constant) ; éteinte hors de la remise. Sans ombre au sol : elle ne doit rien ajouter au paquet. -->
  <div class="deckbox deckcover relative aspect-[7/12] col-start-1 row-start-1 z-10 pointer-events-none" aria-hidden="true">
    <Motion :ref="(c: unknown) => setCover(c)" :style="{ y, scale, opacity: 0 }" class="deckbox__lift absolute top-1/2 left-1/2 w-[100cqw] will-change-transform">
      <Motion :style="{ transformPerspective: perspective, rotateX, rotateY }" class="relative aspect-[7/12] [transform-style:preserve-3d] will-change-transform">
        <span v-for="(l, k) in coverLayers" :key="k" class="absolute inset-0 rounded-[4cqw]" :style="l"></span>
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
