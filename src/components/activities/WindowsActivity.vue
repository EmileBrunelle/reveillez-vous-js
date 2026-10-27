<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { animate } from 'motion-v'
import { useIntervalFn, useTimeoutFn } from '@vueuse/core'
import ActivitySkip from './ActivitySkip.vue'
import ActivityHud from './ActivityHud.vue'
import { durationOf } from '../../engine/activityTiming'
import { useActivityDone } from '../../composables/useActivityDone'
import { useReducedMotion } from '../../composables/useReducedMotion'
import { useHaptics } from '../../composables/haptics'
import { knock } from '../../audio/sfx'
import { knockIntensity } from '../../engine/knock'
import { secureRng } from '../../engine/rng'
import { checkStep, hintFor, makeSequence, startInput } from '../../engine/windowSequence'

const props = defineProps<{ level: number }>()
const emit = defineEmits<{ done: [] }>()
const { pulse } = useHaptics()
const { finish, canSkip, outcome, startedAt } = useActivityDone(() => emit('done'), {
  durationMs: durationOf('windows'),
  // Fin : les fenêtres se verrouillent (plus de frappe pendant l’issue) ; seule la réussite affiche la fin réussie.
  onFinish: (o) => {
    stopTicks()
    lit.value = null
    hint.value = null
    phase.value = o === 'win' ? 'won' : 'play'
  },
})
const reduced = useReducedMotion()

// Fenêtre allumée ~700 ms, intervalle de 350 ms ; fondus CSS de 350 ms (variation de luminance bien sous 3 Hz).
const LIT_MS = 700
const GAP_MS = 350
const WINDOWS = 6
const seq = makeSequence(secureRng(), 3, WINDOWS)

const phase = ref<'intro' | 'play' | 'input' | 'won'>('intro')
const lit = ref<number | null>(null)
const input = ref(startInput())
const hint = ref<number | null>(null)
const house = ref<HTMLElement>()
const missed = ref(false)
// Annonce vocale (région aria-live) des phases du jeu.
// À l’échec (temps écoulé), rien : le HUD annonce déjà l’issue.
const status = computed(() =>
  outcome.value === 'fail' ? '' : phase.value === 'won' ? 'Bravo, c’est réussi.' : phase.value === 'input' ? 'À vous.' : missed.value ? 'Ce n’était pas celle-là. On recommence.' : 'Regardez bien…',
)
let playIdx = 0
let shake: { stop: () => void } | undefined

const { start: unlight } = useTimeoutFn(() => (lit.value = null), LIT_MS, { immediate: false })
const { start: unflash } = useTimeoutFn(() => (lit.value = null), 450, { immediate: false })
const { pause: stopTicks, resume: resumeTicks } = useIntervalFn(
  () => {
    if (playIdx >= seq.length) {
      stopTicks()
      phase.value = 'input'
      missed.value = false
      hint.value = hintFor(seq, input.value)
      return
    }
    lit.value = seq[playIdx++]
    pulse(20)
    unlight()
  },
  LIT_MS + GAP_MS,
  { immediate: false, immediateCallback: true },
)
const startPlay = () => {
  if (outcome.value !== 'play') return
  phase.value = 'play'
  hint.value = null
  lit.value = null
  playIdx = 0
  resumeTicks()
}
const { start: replayLater } = useTimeoutFn(startPlay, 700, { immediate: false })
const { start: introLater } = useTimeoutFn(startPlay, 700, { immediate: false })
onMounted(introLater)
onUnmounted(() => shake?.stop())

const hit = (i: number) => {
  if (phase.value !== 'input' || outcome.value !== 'play') return
  const { state, result } = checkStep(seq, input.value, i)
  input.value = state
  if (result === 'wrong') {
    missed.value = true
    phase.value = 'play' // verrouille les entrées pendant la secousse et le rejeu
    lit.value = null
    hint.value = null
    if (house.value && !reduced.value) {
      shake?.stop()
      shake = animate(house.value, { x: [-12, 0] }, { type: 'spring', stiffness: 700, damping: 7 })
    }
    replayLater()
    return
  }
  knock(knockIntensity(props.level))
  pulse(20)
  lit.value = i
  unflash()
  hint.value = hintFor(seq, state)
  if (result === 'done') {
    phase.value = 'won'
    finish()
  }
}
</script>

<template>
  <div class="size-full flex flex-col items-center justify-center gap-4 px-4 pb-2 select-none">
    <p class="sr-only" role="status" aria-live="polite">{{ status }}</p>
    <p class="font-ui text-xl text-center text-amber-100/90 max-w-[22ch]" :class="{ invisible: outcome !== 'play' }">Frappez aux fenêtres dans l’ordre où elles s’allument</p>
    <div ref="house" class="relative w-[min(78vw,300px)]">
      <div class="h-[70px] bg-[#0b0a10] [clip-path:polygon(50%_0,100%_100%,0_100%)]" aria-hidden="true" />
      <div class="grid grid-cols-2 gap-4 p-4 bg-[#0b0a10]">
        <button
          v-for="i in WINDOWS"
          :key="i"
          type="button"
          :aria-label="`Fenêtre ${i}`"
          :aria-disabled="phase !== 'input'"
          class="aspect-[4/3] border-4 border-[#1d1a26] cursor-pointer transition-[background-color,box-shadow] duration-350 ease-in-out focus-visible:outline-3 focus-visible:outline-amber-200"
          :class="lit === i - 1 ? 'bg-amber-300 shadow-[0_0_28px_8px_rgba(252,211,77,0.55)]' : hint === i - 1 ? 'bg-amber-900/50 shadow-[0_0_12px_2px_rgba(252,211,77,0.15)]' : 'bg-[#15131c]'"
          @click="hit(i - 1)"
        />
      </div>
    </div>
    <ActivityHud activity="windows" :outcome="outcome" :started-at="startedAt" />
    <ActivitySkip :show="canSkip" @skip="finish" />
  </div>
</template>
