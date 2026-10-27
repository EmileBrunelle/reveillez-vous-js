<script setup lang="ts">
// Invite commune des activités chronométrées : un verbe géant qui surgit au ressort puis se range en bas à gauche, une barre de temps
// qui se vide en continu (aucune variation de luminance : seule la largeur change) et l’issue (réussite ou échec) affichée environ 1 s.
import { computed, nextTick, onMounted, onUnmounted, ref, watch, useTemplateRef } from 'vue'
import { animate } from 'motion-v'
import { Progress } from '@vuetify/v0'
import { useRafFn, useTimeoutFn } from '@vueuse/core'
import { useReducedMotion } from '../../composables/useReducedMotion'
import { ACTIVITY_PROMPTS, type TimedActivity } from '../../content/activityPrompts'
import { durationOf, timeLeft, type Phase } from '../../engine/activityTiming'
import { playStinger } from '../../audio/stinger'
import { muted } from '../../audio/sfx'

const props = defineProps<{ activity: TimedActivity; outcome: Phase; startedAt: number }>()
const prompt = computed(() => ACTIVITY_PROMPTS[props.activity])
const duration = computed(() => durationOf(props.activity))
const reduced = useReducedMotion()

// Barre : part de temps restante (0–100), mise à jour à chaque image ; elle s’arrête à l’issue.
const left = ref(100)
const { pause } = useRafFn(() => {
  left.value = timeLeft(Date.now() - props.startedAt, duration.value) * 100
})
// Jingle en cours : coupé au démontage et si le son passe en muet pendant la lecture.
let stopStinger: () => void = () => {}
onUnmounted(() => {
  pause()
  stopStinger()
})
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
  () => props.outcome,
  async (o) => {
    if (o === 'play') return
    pause()
    stopStinger = playStinger(o, o === 'win' ? (prompt.value.winStingerDelay ?? 0) : 0)
    await nextTick()
    if (resultEl.value && !reduced.value) animate(resultEl.value, { scale: [0.3, 1], rotate: o === 'win' ? [-6, 0] : [4, 0] }, { type: 'spring', stiffness: 480, damping: 9 })
  },
)

const hurry = computed(() => left.value < 25 && props.outcome === 'play')
</script>

<template>
  <div ref="rootEl" class="pointer-events-none absolute inset-0 z-20 select-none" data-testid="activity-hud">
    <p class="sr-only" role="status">{{ outcome === 'win' ? prompt.win : outcome === 'fail' ? prompt.fail : '' }}</p>
    <!-- verbe : plein centre à l’apparition, puis rangé en bas à gauche -->
    <div class="absolute inset-0 flex items-center justify-center" :class="{ invisible: outcome !== 'play' }" aria-hidden="true">
      <p
        ref="verbEl"
        class="m-0 font-title font-bold text-center whitespace-nowrap text-[clamp(2.4rem,14vw,5.5rem)] leading-none text-amber-200 [text-shadow:0_4px_0_#000,0_0_22px_#000,0_0_40px_rgb(0_0_0/0.8)]"
      >
        {{ prompt.verb }}
      </p>
    </div>
    <!-- barre de temps : à gauche du bouton « Passer » -->
    <Progress.Root :model-value="left" :min="0" :max="100" aria-label="Temps restant" class="absolute bottom-3 left-3 right-32 sm:right-36">
      <Progress.Track class="h-3.5 border-2 border-solid border-black bg-black/70 p-px">
        <Progress.Fill class="h-full" :class="hurry ? 'bg-red-500' : 'bg-amber-300'" />
      </Progress.Track>
    </Progress.Root>
    <!-- issue -->
    <div v-if="outcome !== 'play'" class="absolute inset-x-0 bottom-14 flex justify-center px-4" aria-hidden="true">
      <p
        ref="resultEl"
        class="m-0 max-w-[22ch] rounded-lg border-2 border-solid border-amber-200 bg-[#0b0a10] px-4 py-2 text-center font-title font-bold leading-tight text-[clamp(1.5rem,7vw,2.6rem)] [text-shadow:0_4px_0_#000,0_0_22px_#000,0_0_40px_rgb(0_0_0/0.8)]"
        :class="outcome === 'win' ? 'text-emerald-300' : 'text-red-300'"
      >
        {{ outcome === 'win' ? prompt.win : prompt.fail }}
      </p>
    </div>
  </div>
</template>
