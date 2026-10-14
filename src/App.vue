<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch, watchEffect } from 'vue'
import { AnimatePresence, Motion, MotionConfig, animate, useReducedMotion } from 'motion-v'
import DoorScene from './components/DoorScene.vue'
import Concentration from './components/Concentration.vue'
import TarotCard from './components/TarotCard.vue'
import CrtOverlay from './components/CrtOverlay.vue'
import MuteToggle from './components/MuteToggle.vue'
import WebGpuGate from './components/WebGpuGate.vue'
import AboutTempleOS from './components/AboutTempleOS.vue'
import Vigilance from './components/Vigilance.vue'
import { bumpVisits, levelForVisits, readVisits, resetVisits } from './composables/useVisits'
import { backgrounds, doors } from './content/scenes'
import { prophecies } from './content/prophecies'
import { nextDoorLine, nextProphecy, type Prophecy, EMPTY_ARCANE } from './engine/prophecy'
import { secureRng } from './engine/rng'
import { pickVariant } from './engine/variant'
import { safeStorage } from './composables/safeStorage'
import { hymn, unlock } from './audio/sfx'

type Phase = 'door' | 'concentration' | 'reading'
const rng = secureRng()
const FALLBACK_LINE = 'Toc toc toc… Avez-vous un moment pour parler de votre avenir ?'

// 'checking' until the CRT overlay got a WebGPU device; nothing of the experience renders before that.
const gpu = ref<'checking' | 'ok' | 'blocked'>('checking')
const attempt = ref(0)
const retry = () => {
  gpu.value = 'checking'
  attempt.value++
}

const aboutOpen = ref(false)
let opener: HTMLElement | null = null
const openAbout = () => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  aboutOpen.value = true
}
watch(aboutOpen, (o) => {
  if (!o) nextTick(() => opener?.focus())
})

const level = ref(levelForVisits(readVisits()))
const paranoia = computed(() => (level.value - 1) / 4)
watchEffect(() => document.documentElement.style.setProperty('--paranoia', String(paranoia.value)))

const resetLevel = () => {
  resetVisits()
  level.value = levelForVisits(readVisits())
}

const phase = ref<Phase>('door')
const closing = ref(false)
const sceneKey = ref(0)
const reduced = useReducedMotion()
const mainEl = ref<HTMLElement>()
const shake = (amp: number) => {
  if (reduced.value || !mainEl.value) return
  const a = 10 * amp
  animate(mainEl.value, { x: [0, -a, a * 0.8, -a * 0.5, a * 0.3, 0], y: [0, a * 0.4, -a * 0.5, a * 0.2, 0] }, { duration: 0.35 })
}
const door = shallowRef(doors[0])
const background = shallowRef(backgrounds[0])
const doorLine = ref(FALLBACK_LINE)
const prophecy = ref<Prophecy>({ question: '', body: '', verse: '', arcane: EMPTY_ARCANE })

const enterDoor = () => {
  door.value = pickVariant(doors, level.value, door.value.id, rng)
  background.value = pickVariant(backgrounds, level.value, background.value.id, rng)
  doorLine.value = nextDoorLine(prophecies, level.value, safeStorage(), rng, FALLBACK_LINE)
  phase.value = 'door'
  closing.value = false
  sceneKey.value++
}
enterDoor()

const onDone = () => {
  prophecy.value = nextProphecy(prophecies, level.value, safeStorage(), rng)
  phase.value = 'reading'
  hymn()
}
const restart = () => {
  if (closing.value) return
  closing.value = true
  unlock()
  level.value = levelForVisits(bumpVisits())
  // The open door slams first; the next variant is picked once it is shut (see onClosed).
  sceneKey.value++
  phase.value = 'door'
}

// Browsers keep the AudioContext suspended until a user gesture; without one, the first knocks would be silent.
const awaiting = ref(!navigator.userActivation?.hasBeenActive)
const approach = () => {
  unlock()
  // Give the context a moment to reach 'running' so scheduleKnocks sees it live.
  window.setTimeout(() => (awaiting.value = false), 120)
}

const closeBtn = ref<HTMLButtonElement>()
const focusSoon = (find: () => HTMLElement | null | undefined) => {
  let n = 0
  const t = () => {
    const el = find()
    if (el) return el.focus({ preventScroll: true })
    if (n++ < 60) requestAnimationFrame(t)
  }
  requestAnimationFrame(t)
}
const onFlipped = () => void nextTick(() => closeBtn.value?.focus({ preventScroll: true }))
// A phase unmounting drops focus to <body>: send it to the door button of the next door.
watch(
  () => [phase.value, closing.value, awaiting.value, gpu.value] as const,
  ([p, c, a, g]) => {
    if (p === 'door' && !c && !a && g === 'ok') focusSoon(() => document.querySelector<HTMLElement>('.door-hit'))
  },
  { flush: 'post' },
)
const onClosed = () => {
  enterDoor()
}
</script>

<template>
  <WebGpuGate v-if="gpu === 'blocked'" @retry="retry" @about="openAbout" />
  <MotionConfig v-else reduced-motion="user">
    <CrtOverlay :key="attempt" :paranoia="paranoia" @ready="gpu = 'ok'" @fail="gpu = 'blocked'" />
    <p v-if="gpu === 'checking'" class="fixed inset-0 m-0 grid place-items-center text-[0.9rem] tracking-[0.1em] opacity-0 text-fg animate-[checking-in_0.6s_ease_0.4s_forwards] pointer-events-none" role="status">Connexion aux ondes…</p>
    <template v-if="gpu === 'ok'">
      <component :is="background.component" />
      <MuteToggle class="fixed top-[0.6rem] right-[0.6rem] z-10" />
      <button v-if="awaiting" class="fixed inset-0 z-20 grid place-items-center w-full border-0 bg-transparent text-fg [font-family:inherit] text-[1.2rem] tracking-[0.08em] cursor-pointer focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-fg focus-visible:outline-offset-[-12px]" type="button" autofocus @click="approach">Approchez-vous de la porte</button>
      <main v-else ref="mainEl" class="app relative z-1 min-h-[100vh] grid place-items-center pt-[3.5rem] px-[1rem] pb-[3rem] overflow-clip" :class="{ 'app--reading': phase === 'reading' }">
        <AnimatePresence mode="wait">
          <Motion v-if="phase === 'door'" :key="`door-${sceneKey}`" class="w-full max-w-[36rem] grid justify-items-center" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }" :transition="{ duration: 0.2 }">
            <DoorScene
              :door="door"
              :line="doorLine"
              :level="level"
              :closing="closing"
              @open="phase = 'concentration'"
              @about="openAbout"
              @impact="shake"
              @closed="onClosed"
            />
          </Motion>
          <Motion v-else-if="phase === 'concentration'" key="concentration" class="w-full max-w-[36rem] grid justify-items-center" :initial="{ opacity: 0, scale: 0.96 }" :animate="{ opacity: 1, scale: 1 }" :exit="{ opacity: 0, scale: 1.04 }" :transition="{ duration: 0.25 }">
            <Concentration @done="onDone" />
          </Motion>
          <Motion v-else key="reading" class="w-full max-w-[36rem] grid justify-items-center h-full min-h-0 grid-rows-[minmax(0,1fr)] [@media(orientation:landscape)_and_(max-height:520px)]:max-w-[48rem]" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }" :transition="{ duration: 0.2 }">
            <section class="w-full max-w-[36rem] text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation flex flex-col gap-3 items-center h-full min-h-0 [@media(orientation:landscape)_and_(max-height:520px)]:flex-row [@media(orientation:landscape)_and_(max-height:520px)]:gap-4">
              <div class="flex-[1_1_0] min-h-0 w-full [container-type:size] grid place-items-center [@media(orientation:landscape)_and_(max-height:520px)]:h-full">
                <TarotCard :arcane="prophecy.arcane" :title="prophecy.question" :body="prophecy.body" :verse="prophecy.verse" :level="level" @flipped="onFlipped" />
              </div>
              <div class="flex flex-none flex-wrap gap-3 justify-center">
                <button ref="closeBtn" class="btn-alt" type="button" :disabled="closing" @click="restart">Fermer la porte</button>
              </div>
            </section>
          </Motion>
        </AnimatePresence>
      </main>
      <Vigilance class="fixed left-[0.6rem] bottom-[0.6rem] z-10 bg-[#000] px-2 py-[0.2rem]" :level="level" @reset="resetLevel" />
    </template>
  </MotionConfig>
  <AboutTempleOS v-model="aboutOpen" />
</template>
