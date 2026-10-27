<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { AnimatePresence, Motion, MotionConfig, animate } from 'motion-v'
import { storeToRefs } from 'pinia'
import CrtOverlay from './components/CrtOverlay.vue'
import WebGpuGate from './components/WebGpuGate.vue'
import Taskbar from './components/Taskbar.vue'
import FakeErrors from './components/FakeErrors.vue'
import BgPlace from './components/backgrounds/BgPlace.vue'
import { useProgressStore } from './stores/progress'
import { useCollectionStore } from './stores/collection'
import { isQuickKnock } from './engine/paranoia'
import { useTabTitle } from './composables/useTabTitle'
import { useReducedMotion } from './composables/useReducedMotion'
import { requestOrientationPermission } from './composables/useTilt'
import { useTimeoutFn } from '@vueuse/core'
import { unlock } from './audio/sfx'
import { WAKE_LABEL } from './content/finale'
import { focusQuietly } from './composables/focusQuietly'
import { createFocusOnce } from './composables/focusOnce'
import { useLazyScenes } from './composables/useLazyScenes'
import { useGameFlow } from './composables/useGameFlow'

// Hors du premier écran : chargés à la demande, préchargés dès que possible (voir useLazyScenes).
const { tarotFailed, ensureTarot, TarotCard, DoorScene, ensureDoor, About, ResetConfirm, CollectionWindow, SoundWindow, DeckCut, Finale } = useLazyScenes()

// Focus au montage (pas d’autofocus : Chrome y montrerait l’anneau avant toute entrée) ; sans entrée connue, on le traite comme un pointeur.
// Ref fonction rappelée à chaque rendu : createFocusOnce ne focalise qu’une fois par élément (une réapparition de l’overlay = nouvel élément).
const focusOverlay = createFocusOnce()
const closeBtn = ref<HTMLButtonElement>()
const readingEl = ref<HTMLElement>()

// Phases d’une visite (porte -> activité -> coupe -> lecture -> finale) : voir useGameFlow.
const {
  rng,
  phase,
  closing,
  listening,
  sceneKey,
  door,
  place,
  placeVariant,
  doorLine,
  crtOff,
  pickedPaquet,
  prophecy,
  cardSettled,
  Activity,
  startBubble,
  resetLevel,
  onDone,
  onActivityDone,
  onPick,
  onFlipped,
  onClose,
  onClosed,
  onCollapsed,
  onFinaleRestart,
} = useGameFlow({ ensureTarot, tarotFailed, closeBtn, readingEl })

// 'checking' until the CRT overlay got a WebGPU device; nothing of the experience renders before that.
const gpu = ref<'checking' | 'ok' | 'blocked'>('checking')
// Le réseau sert d’abord au premier écran (CRT, vgpu) : le reste ne part qu’une fois le GPU confirmé.
watch(gpu, (g) => g === 'ok' && void ensureDoor().catch(() => undefined), { immediate: true })
const attempt = ref(0)
const retry = () => {
  gpu.value = 'checking'
  attempt.value++
}

const aboutOpen = ref(false)
let opener: HTMLElement | null = null
const aboutWanted = ref(false) // monté (donc chargé) à la première ouverture seulement
const resetWanted = ref(false)
const openAbout = () => {
  aboutWanted.value = true
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  aboutOpen.value = true
}
watch(aboutOpen, (o) => {
  if (!o) nextTick(() => focusQuietly(opener))
})

const progress = useProgressStore()
const soundOpen = ref(false)
const soundWanted = ref(false) // monté (donc chargé) à la première ouverture seulement
const openSound = () => {
  soundWanted.value = true
  soundOpen.value = true
}
const collection = useCollectionStore()
const collectionOpen = ref(false)
const collectionWanted = ref(false) // monté (donc chargé) à la première ouverture seulement
const openCollection = () => {
  collectionWanted.value = true
  collectionOpen.value = true
}
// Remise à zéro complète (« Oublier ») : en plus du niveau, la collection est effacée.
const forgetAll = () => {
  collection.clear()
  resetLevel()
}
const { level, paranoia } = storeToRefs(progress)
useTabTitle(level)

const resetOpen = ref(false)
watch(resetOpen, (o) => o && (resetWanted.value = true))

const reduced = useReducedMotion()
const mainEl = ref<HTMLElement>()
const shake = (amp: number) => {
  if (reduced.value || !mainEl.value) return
  const a = 10 * amp
  animate(mainEl.value, { x: [0, -a, a * 0.8, -a * 0.5, a * 0.3, 0], y: [0, a * 0.4, -a * 0.5, a * 0.2, 0] }, { duration: 0.35 })
}

// Browsers keep the AudioContext suspended until a user gesture; without one, the first knocks would be silent.
const awaiting = ref(!navigator.userActivation?.hasBeenActive)
const { start: startAwaitEnd } = useTimeoutFn(() => (awaiting.value = false), 120, { immediate: false })
const approach = () => {
  unlock()
  requestOrientationPermission()
  // Give the context a moment to reach 'running' so scheduleKnocks sees it live.
  ensureDoor().then(startAwaitEnd, () => undefined)
}

const focusSoon = (find: () => HTMLElement | null | undefined) => {
  let n = 0
  const t = () => {
    const el = find()
    if (el) return focusQuietly(el, { preventScroll: true })
    if (n++ < 60) requestAnimationFrame(t)
  }
  requestAnimationFrame(t)
}
// A phase unmounting drops focus to <body>: send it to the door button of the next door.
watch(
  () => [phase.value, closing.value, awaiting.value, gpu.value, DoorScene.value] as const,
  ([p, c, a, g, d]) => {
    if (p === 'door' && !c && !a && g === 'ok' && d) {
      focusSoon(() => document.querySelector<HTMLElement>('.door-hit'))
      startBubble()
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <WebGpuGate v-if="gpu === 'blocked'" @retry="retry" @about="openAbout" />
  <MotionConfig v-else reduced-motion="user">
    <CrtOverlay :key="attempt" :paranoia="paranoia" :off="crtOff" @ready="gpu = 'ok'" @fail="gpu = 'blocked'" />
    <p
      v-if="gpu === 'checking'"
      class="fixed inset-0 m-0 grid place-items-center text-[0.9rem] tracking-[0.1em] opacity-0 text-fg animate-[checking-in_0.6s_ease_0.4s_forwards] pointer-events-none"
      role="status"
    >
      Connexion aux ondes…
    </p>
    <template v-if="gpu === 'ok'">
      <BgPlace :key="place.id" :place="place.id" :variant="placeVariant.params" :sharp="crtOff" />
      <div
        class="fixed inset-0 z-0 pointer-events-none bg-[rgb(120_0_0/0.35)] transition-opacity duration-[400ms] motion-reduce:transition-none"
        :class="listening ? 'opacity-100' : 'opacity-0'"
        aria-hidden="true"
      />
      <button
        v-if="awaiting"
        :ref="focusOverlay"
        class="fixed inset-0 z-20 grid place-items-center w-full border-0 bg-transparent text-fg [font-family:inherit] text-[1.2rem] tracking-[0.08em] cursor-pointer focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-fg focus-visible:outline-offset-[-0.6667rem]"
        type="button"
        @click="approach"
      >
        Approchez-vous de la porte
      </button>
      <main
        v-else-if="DoorScene"
        ref="mainEl"
        class="app relative z-1 min-h-[100vh] min-h-[100dvh] grid place-items-center pt-[var(--pad-t)] pr-[var(--pad-x-r)] pl-[var(--pad-x-l)] pb-[calc(0.75rem+var(--taskbar-h))] overflow-clip"
        :class="{ 'app--reading': phase === 'reading' || phase === 'cut' }"
      >
        <AnimatePresence mode="wait">
          <Motion
            v-if="phase === 'door'"
            :key="`door-${sceneKey}`"
            class="w-full max-w-[36rem] min-[1600px]:max-w-[90rem] grid justify-items-center"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :transition="{ duration: 0.2 }"
          >
            <component
              :is="DoorScene"
              :door="door"
              :line="doorLine"
              :level="level"
              :closing="closing"
              :quick="isQuickKnock(progress.knocked, level)"
              @knocked="progress.markKnocked"
              @open="onDone"
              @about="openAbout"
              @reset="resetOpen = true"
              @reset-level="resetLevel"
              @listening="(v: boolean) => (listening = v)"
              @impact="shake"
              @closed="onClosed"
            />
          </Motion>
          <Motion
            v-else-if="phase === 'activity' && Activity"
            key="activity"
            class="relative w-full max-w-[36rem] min-[1600px]:max-w-[90rem] h-[calc(100dvh-0.75rem-var(--pad-t)-var(--taskbar-h))] min-h-[22rem] grid"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :transition="{ duration: 0.2 }"
          >
            <component :is="Activity" :level="level" @done="onActivityDone" />
          </Motion>
          <Motion
            v-else-if="phase === 'cut' || phase === 'reading'"
            key="deal"
            class="w-full max-w-[36rem] min-[1600px]:max-w-[90rem] grid justify-items-center h-full min-h-0 grid-rows-[minmax(0,1fr)] [@media(orientation:landscape)_and_(max-height:32.5rem)]:max-w-[48rem]"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :transition="{ duration: 0.2 }"
          >
            <!-- Une seule structure pour la coupe et la lecture : la boîte de la carte ne change donc jamais entre les deux. -->
            <section
              ref="readingEl"
              tabindex="-1"
              class="w-full max-w-[36rem] min-[1600px]:max-w-[90rem] text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation outline-none flex flex-col gap-3 items-center h-full min-h-0 [@media(orientation:landscape)_and_(max-height:32.5rem)]:flex-row [@media(orientation:landscape)_and_(max-height:32.5rem)]:gap-4"
            >
              <div class="flex-[1_1_0] min-h-0 w-full [container-type:size] grid place-items-center [@media(orientation:landscape)_and_(max-height:32.5rem)]:h-full">
                <DeckCut v-if="phase === 'cut'" :level="level" :rng="rng" @pick="onPick" />
                <div v-else-if="tarotFailed" class="max-h-full overflow-auto w-full max-w-[70ch] mx-auto p-4 text-left font-card [background:#f3e3b3] [color:#170a2b] [border:0.3rem_solid_#1f1038]">
                  <h2 class="font-title m-0 mb-2 text-[1.1rem] uppercase">{{ prophecy.question }}</h2>
                  <p class="m-0 mb-2 text-[1.1rem]">{{ prophecy.body }}</p>
                  <p class="m-0 italic text-right">— {{ prophecy.verse }}</p>
                </div>
                <component
                  :is="TarotCard"
                  v-else-if="TarotCard"
                  :arcane="prophecy.arcane"
                  :title="prophecy.question"
                  :body="prophecy.body"
                  :verse="prophecy.verse"
                  :level="level"
                  handoff
                  :paquet="pickedPaquet"
                  @flipped="onFlipped"
                />
              </div>
              <div class="flex flex-none flex-wrap gap-3 justify-center" :class="{ invisible: phase === 'cut' }" :inert="phase === 'cut'">
                <button ref="closeBtn" class="btn-alt" type="button" :disabled="closing" @click="onClose">{{ level >= 5 ? WAKE_LABEL : 'Fermer la porte' }}</button>
              </div>
            </section>
          </Motion>
          <Motion
            v-else-if="phase === 'finale'"
            key="finale"
            class="w-full max-w-[36rem] min-[1600px]:max-w-[90rem] grid justify-items-center"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :transition="{ duration: 0.2 }"
          >
            <Finale @collapsed="onCollapsed" @restart="onFinaleRestart" />
          </Motion>
        </AnimatePresence>
      </main>
    </template>
  </MotionConfig>
  <FakeErrors v-if="gpu === 'ok' && phase === 'reading' && cardSettled" :key="sceneKey" :level="level" />
  <Taskbar v-if="gpu === 'ok'" :level="level" @about="openAbout" @collection="openCollection" @sound="openSound" @reset="resetOpen = true" @reset-level="resetLevel" />
  <About v-if="aboutWanted" v-model="aboutOpen" />
  <CollectionWindow v-if="collectionWanted" v-model="collectionOpen" />
  <SoundWindow v-if="soundWanted" v-model="soundOpen" />
  <ResetConfirm v-if="resetWanted" v-model="resetOpen" @confirm="forgetAll" />
</template>
