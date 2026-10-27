<script setup lang="ts">
// Invite commune des activités chronométrées : un verbe géant qui surgit au ressort puis se range en bas à gauche, une barre de temps
// qui se vide en continu (animation CSS : aucune variation de luminance, seule la largeur change) et l’issue (réussite ou échec) affichée environ 1 s.
// L’issue est annoncée ici une seule fois (région role=status) : les activités ne la répètent pas.
import { computed, nextTick, onMounted, onUnmounted, ref, watch, useTemplateRef } from 'vue'
import { animate } from 'motion-v'
import { useIntervalFn, useTimeoutFn } from '@vueuse/core'
import { useReducedMotion } from '../../composables/useReducedMotion'
import { ACTIVITY_PROMPTS, type TimedActivity } from '../../content/activityPrompts'
import { durationOf, outcomeText, timeLeft, type Phase } from '../../engine/activityTiming'
import { playStinger } from '../../audio/stinger'
import { muted } from '../../audio/sfx'

const { activity, outcome, startedAt } = defineProps<{ activity: TimedActivity; outcome: Phase; startedAt: number }>()
const prompt = computed(() => ACTIVITY_PROMPTS[activity])
const duration = computed(() => durationOf(activity))
const announcement = computed(() => outcomeText(activity, outcome))
const reduced = useReducedMotion()

// Barre : l’animation CSS (`drain`) la vide en `duration` ms, déjà entamée si le HUD monte après le départ du chrono (délai négatif) ;
// elle se fige à l’issue. Seule la valeur accessible (aria-valuenow) passe par l’état, deux fois par seconde.
const elapsedAtMount = Date.now() - startedAt
// Durée et délai de l’animation, lus par le style via `v-bind()` (variables sur la racine du composant).
const drainMs = computed(() => `${duration.value}ms`)
const drainFrom = `${-elapsedAtMount}ms`
const left = ref(Math.round(timeLeft(elapsedAtMount, duration.value) * 100))
const { pause: pauseTick } = useIntervalFn(() => (left.value = Math.round(timeLeft(Date.now() - startedAt, duration.value) * 100)), 500)
// Jingle en cours : coupé au démontage et si le son passe en muet pendant la lecture.
let stopStinger: () => void = () => {}
onUnmounted(() => stopStinger())
watch(muted, (m) => m && stopStinger())

const rootEl = useTemplateRef<HTMLElement>('rootEl')
const verbEl = useTemplateRef<HTMLElement>('verbEl')
const resultEl = useTemplateRef<HTMLElement>('resultEl')
const SCALE_DOCKED = 0.34
// Rangement : le verbe géant, centré, se réduit puis se pose en bas à gauche, au-dessus de la barre. Un seul maître du transform : animate.
const dock = () => {
  const root = rootEl.value
  const el = verbEl.value
  if (!root || !el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  const x = 12 + (w * SCALE_DOCKED) / 2 - root.offsetWidth / 2
  const y = root.offsetHeight - 40 - (h * SCALE_DOCKED) / 2 - root.offsetHeight / 2
  animate(el, { scale: SCALE_DOCKED, x, y }, reduced.value ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 22 })
}
const { start: dockLater } = useTimeoutFn(dock, 800, { immediate: false })
onMounted(() => {
  if (reduced.value) return dock()
  if (verbEl.value) animate(verbEl.value, { scale: [0.2, 1], opacity: [0, 1] }, { type: 'spring', stiffness: 520, damping: 11 })
  dockLater()
})

// Issue : arrêt de la barre, jingle, et surgissement au ressort du texte.
watch(
  () => outcome,
  async (o) => {
    if (o === 'play') return
    pauseTick()
    stopStinger = playStinger(o, o === 'win' ? (prompt.value.winStingerDelay ?? 0) : 0)
    await nextTick()
    if (resultEl.value && !reduced.value) animate(resultEl.value, { scale: [0.3, 1], rotate: o === 'win' ? [-6, 0] : [4, 0] }, { type: 'spring', stiffness: 480, damping: 9 })
  },
)
</script>

<template>
  <div ref="rootEl" class="pointer-events-none absolute inset-0 z-20 select-none" data-testid="activity-hud">
    <p class="sr-only" role="status">{{ announcement }}</p>
    <!-- verbe : plein centre à l’apparition, puis rangé en bas à gauche -->
    <div class="absolute inset-0 flex items-center justify-center" :class="{ invisible: outcome !== 'play' }" aria-hidden="true">
      <p
        ref="verbEl"
        class="m-0 font-title font-bold text-center whitespace-nowrap text-[clamp(2.4rem,14vw,5.5rem)] leading-none text-amber-200 [text-shadow:0_4px_0_#000,0_0_22px_#000,0_0_40px_rgb(0_0_0/0.8)]"
      >
        {{ prompt.verb }}
      </p>
    </div>
    <!-- barre de temps : à gauche du bouton « Passer » ; le rouge de la fin (derniers 25 %) est dans l’animation.
         Pas de Progress de v0 ici : son Fill écrit lui-même `style.width` (même en renderless), ce qui entre en conflit avec l’animation `scaleX`
         et obligerait à mettre l’état à jour à chaque image ; la barre est donc un `role="progressbar"` natif dont seule la valeur accessible vit dans l’état. -->
    <div
      role="progressbar"
      aria-label="Temps restant"
      :aria-valuenow="left"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`${left} %`"
      class="absolute bottom-3 left-3 right-32 sm:right-36 h-3.5 border-2 border-solid border-black bg-black/70 p-px"
    >
      <div class="drain h-full origin-left" :class="{ paused: outcome !== 'play' }" />
    </div>
    <!-- issue -->
    <div v-if="outcome !== 'play'" class="absolute inset-x-0 bottom-14 flex justify-center px-4" aria-hidden="true">
      <p
        ref="resultEl"
        class="m-0 max-w-[22ch] rounded-lg border-2 border-solid border-amber-200 bg-[#0b0a10] px-4 py-2 text-center font-title font-bold leading-tight text-[clamp(1.5rem,7vw,2.6rem)] [text-shadow:0_4px_0_#000,0_0_22px_#000,0_0_40px_rgb(0_0_0/0.8)]"
        :class="outcome === 'win' ? 'text-emerald-300' : 'text-red-300'"
      >
        {{ announcement }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Vidage : transform seulement (compositeur), couleur fixée par paliers (ambre puis rouge à 75 % du temps écoulé). */
.drain {
  background-color: #fcd34d;
  animation: drain v-bind(drainMs) linear v-bind(drainFrom) both;
}
.drain.paused {
  animation-play-state: paused;
}
@keyframes drain {
  from {
    transform: scaleX(1);
  }
  74.99% {
    background-color: #fcd34d;
  }
  75% {
    background-color: #ef4444;
  }
  to {
    transform: scaleX(0);
    background-color: #ef4444;
  }
}
/* Mouvement réduit : la barre avance par paliers au lieu de glisser. */
@media (prefers-reduced-motion: reduce) {
  .drain {
    animation-timing-function: steps(20, end);
  }
}
</style>
