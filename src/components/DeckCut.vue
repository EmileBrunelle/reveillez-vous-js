<script setup lang="ts">
import { ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import TarotCardBack from './TarotCardBack.vue'
import { FAN, FAN_SCALE } from './deckFan'
import { useReducedMotion } from '../composables/useReducedMotion'

// Coupe du paquet : trois dos de carte en éventail, dans la même boîte (7:12) que la carte du tirage. La carte choisie reste en place,
// les deux autres glissent vers l’extérieur ; `pick` part à la fin de la sortie, et TarotCard donne la carte depuis cette position (deckFan.ts).
defineProps<{ level: number }>()
const emit = defineEmits<{ pick: [index: 0 | 1 | 2] }>()
const reduced = useReducedMotion()

const deckEl = ref<HTMLElement>()
const chosen = ref<0 | 1 | 2 | null>(null)
const EXIT_MS = 480
const EXIT_REDUCED_MS = 150
const { start } = useTimeoutFn(
  () => emit('pick', chosen.value ?? 0),
  () => (reduced.value ? EXIT_REDUCED_MS : EXIT_MS),
  { immediate: false },
)

const choose = (i: 0 | 1 | 2) => {
  if (chosen.value !== null) return
  chosen.value = i
  deckEl.value?.focus() // les boutons se désactivent puis disparaissent : le focus reste dans la coupe au lieu de tomber sur <body>
  start()
}
const cards = [0, 1, 2] as const
</script>

<template>
  <!-- Même structure que la lecture dans App.vue (emplacement + rangée du bouton « Fermer la porte », ici invisible) : rien ne bouge entre la coupe et la carte. -->
  <section
    class="w-full max-w-[36rem] text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation flex flex-col gap-3 items-center h-full min-h-0 [@media(orientation:landscape)_and_(max-height:32.5rem)]:flex-row [@media(orientation:landscape)_and_(max-height:32.5rem)]:gap-4"
  >
    <div class="flex-[1_1_0] min-h-0 w-full [container-type:size] grid place-items-center [@media(orientation:landscape)_and_(max-height:32.5rem)]:h-full">
      <div
        ref="deckEl"
        tabindex="-1"
        class="deck relative outline-none aspect-[7/12]"
        :class="{ 'deck--reduced': reduced, 'deck--chosen': chosen !== null }"
        role="group"
        aria-labelledby="deck-prompt"
      >
        <p class="absolute size-px m-[-1px] overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" role="status" aria-live="polite">{{ chosen !== null ? 'Carte choisie.' : '' }}</p>
        <p id="deck-prompt" class="deck__prompt absolute inset-x-0 top-[12cqw] m-0 font-ui text-[7cqw] leading-[1.1] [color:#f3e3b3] [text-shadow:0.4cqw_0.4cqw_0_#000]">Choisissez une carte.</p>
        <button
          v-for="i in cards"
          :key="i"
          type="button"
          class="deck__card absolute top-1/2 left-1/2 p-0 m-0 border-0 [background:none] cursor-pointer rounded-[4cqw] focus-visible:[outline:0.9cqw_solid_#f3e3b3] focus-visible:outline-offset-[1.2cqw]"
          :class="[`deck__card--${i}`, { 'deck__card--chosen': chosen === i, 'deck__card--gone': chosen !== null && chosen !== i }]"
          :style="{ '--fx': `${FAN[i].x}cqw`, '--fy': `${FAN[i].y}cqw`, '--fr': `${FAN[i].rot}deg`, '--fs': FAN_SCALE }"
          :aria-label="`Carte ${i + 1}`"
          :disabled="chosen !== null"
          @click="choose(i)"
        >
          <span class="deck__in block"><TarotCardBack fill /></span>
        </button>
      </div>
    </div>
    <div class="flex flex-none flex-wrap gap-3 justify-center" aria-hidden="true" inert>
      <button class="btn-alt invisible" type="button" tabindex="-1">Fermer la porte</button>
    </div>
  </section>
</template>

<style scoped>
/* Même boîte que .tarot (TarotCard) : la largeur d’une carte en cqw, et l’éventail se place par rapport à cette boîte. */
.deck {
  width: min(100cqw, calc(100cqh * 7 / 12));
  container-type: inline-size;
}
.deck__prompt {
  text-align: center;
}
.deck__card {
  width: calc(100cqw * var(--fs));
  transform: translate(-50%, -50%) translate(var(--fx), var(--fy)) rotate(var(--fr));
  transition:
    transform 0.45s cubic-bezier(0.3, 0.7, 0.3, 1),
    opacity 0.4s ease-out;
}
.deck__in {
  transition: transform 0.2s ease-out;
}
/* Respiration lente (4 s), déplacement seulement : aucun changement de luminance. */
@keyframes deck-breathe {
  50% {
    transform: translateY(-1cqw);
  }
}
.deck:not(.deck--chosen) .deck__in {
  animation: deck-breathe 4s ease-in-out infinite;
}
.deck__card--1 .deck__in {
  animation-delay: -1.3s;
}
.deck__card--2 .deck__in {
  animation-delay: -2.6s;
}
@media (hover: hover) {
  .deck:not(.deck--chosen) .deck__card:hover .deck__in {
    animation: none;
    transform: translateY(-2.5cqw);
  }
}
.deck:not(.deck--chosen) .deck__card:focus-visible .deck__in {
  animation: none;
  transform: translateY(-2.5cqw);
}
.deck__card--gone {
  opacity: 0;
  transform: translate(-50%, -50%) translate(calc(var(--fx) * 2.2), calc(var(--fy) + 6cqw)) rotate(calc(var(--fr) * 1.8));
}
.deck__card--chosen:disabled {
  cursor: default;
}
/* Mouvement réduit : pas d’éventail (cartes droites), pas de glissement ni de respiration, fondu instantané. */
.deck--reduced .deck__card {
  transform: translate(-50%, -50%) translate(var(--fx), var(--fy));
  transition: none;
}
.deck--reduced .deck__card--gone {
  transform: translate(-50%, -50%) translate(var(--fx), var(--fy));
}
.deck--reduced .deck__in {
  animation: none !important;
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .deck__card,
  .deck__in {
    transition: none;
    animation: none !important;
  }
}
</style>
