<script setup lang="ts">
import { computed, defineAsyncComponent, markRaw, nextTick, ref, shallowRef, watch, watchEffect, type Component } from 'vue'
import { AnimatePresence, Motion, MotionConfig, animate } from 'motion-v'
import CrtOverlay from './components/CrtOverlay.vue'
import WebGpuGate from './components/WebGpuGate.vue'
import Taskbar from './components/Taskbar.vue'
import BgPlace from './components/backgrounds/BgPlace.vue'
import { useProgressStore } from './stores/progress'
import { doors, pickPlaceVariant, placeForLevel } from './content/scenes'
import { prophecies } from './content/prophecies'
import { nextDoorLine, nextProphecy, type Prophecy, EMPTY_ARCANE } from './engine/prophecy'
import { secureRng } from './engine/rng'
import { pickVariant } from './engine/variant'
import type { Paquet } from './engine/paquets'
import { storeToRefs } from 'pinia'
import { useTimeoutFn } from '@vueuse/core'
import { useReducedMotion } from './composables/useReducedMotion'
import { requestOrientationPermission } from './composables/useTilt'
import { safeStorage } from './composables/safeStorage'
import { hymn, unlock } from './audio/sfx'
import { activityFor, loadAbout, loadDeckCut, loadDoorScene, loadFinale, loadReset, loadTarotCard, prefetch } from './lazy'

// Hors du premier écran : chargés à la demande, préchargés dès que possible (voir plus bas).
// La carte du tirage est chargée avant la fin de la coupe (jamais de substitut) : on ne la rend qu’une fois le chunk là.
const TarotCard = shallowRef<Component | null>(null)
const tarotFailed = ref(false) // le chunk n’a pas pu se charger : lecture de secours en texte, le jeu ne reste jamais bloqué
const loadTarotOnce = () => loadTarotCard().then((m) => void (TarotCard.value = markRaw(m.default)))
const timeout = (ms: number) => new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
const ensureTarot = async () => {
  if (TarotCard.value) return
  for (let n = 0; n < 2 && !TarotCard.value; n++) await Promise.race([loadTarotOnce(), timeout(3000)]).catch(() => undefined)
  tarotFailed.value = !TarotCard.value
}
const AboutTempleOS = defineAsyncComponent(loadAbout)
const ResetConfirm = defineAsyncComponent(loadReset)
const DeckCut = defineAsyncComponent(loadDeckCut)
const Finale = defineAsyncComponent(loadFinale)
// La scène de la porte s’affiche après « Approchez-vous » : on garde ce bouton tant que son chunk n’est pas là (pas de substitut, donc pas de saut).
const DoorScene = shallowRef<Component | null>(null)
let doorLoad: Promise<unknown> | null = null
const ensureDoor = () =>
  (doorLoad ??= loadDoorScene().then(
    (m) => {
      DoorScene.value = markRaw(m.default)
      prefetch(loadTarotCard) // la carte se tire après les coups : on la réchauffe pendant que la porte s’affiche
    },
    (e) => {
      doorLoad = null // réseau coupé : le prochain clic réessaie
      throw e
    },
  ))

type Phase = 'door' | 'activity' | 'cut' | 'reading' | 'finale'
const rng = secureRng()
const FALLBACK_LINE = 'Toc toc toc… Avez-vous un moment pour parler de votre avenir ?'

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
  if (!o) nextTick(() => opener?.focus())
})

const progress = useProgressStore()
const { level, paranoia } = storeToRefs(progress)
// Activité du niveau courant (null au niveau 1 ou sans activité) ; le composant ne change qu’avec le niveau.
const Activity = computed(() => {
  const loader = activityFor(level.value)
  return loader ? defineAsyncComponent(loader) : null
})
watchEffect(() => document.documentElement.style.setProperty('--paranoia', String(paranoia.value)))

const resetOpen = ref(false)
watch(resetOpen, (o) => o && (resetWanted.value = true))
// « Recommencer à zéro » : on repart tout de suite au niveau 1, sans compter la visite en cours.
const resetLevel = () => {
  progress.reset()
  if (phase.value === 'door') {
    if (!closing.value) enterDoor() // porte pas encore ouverte : on retire porte, réplique et lieu pour le niveau 1
  } else leave(false)
}

const listening = ref(false)
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
const place = shallowRef(placeForLevel(level.value))
const placeVariant = shallowRef(place.value.variants[0])
const pickedPaquet = ref<Paquet>('nuit')
const doorLine = ref(FALLBACK_LINE)
const prophecy = ref<Prophecy>({ question: '', body: '', verse: '', arcane: EMPTY_ARCANE })

const enterDoor = () => {
  door.value = pickVariant(doors, level.value, door.value.id, rng)
  place.value = placeForLevel(level.value)
  placeVariant.value = pickPlaceVariant(place.value, placeVariant.value.id, rng)
  doorLine.value = nextDoorLine(prophecies, level.value, safeStorage(), rng, FALLBACK_LINE)
  phase.value = 'door'
  listening.value = false
  closing.value = false
  sceneKey.value++
}
enterDoor()

// Une visite : la porte s’ouvre -> activité (niveau 2+) -> coupe du paquet -> lecture. La prophétie est tirée une fois, à l’ouverture.
const onDone = () => {
  prefetch(loadTarotCard)
  phase.value = activityFor(level.value) ? 'activity' : 'cut'
  listening.value = false
}
const onActivityDone = () => {
  phase.value = 'cut'
}
// La prophétie est tirée ici, une fois par visite : l’arcane vient du paquet choisi.
const onPick = async (paquet: Paquet) => {
  if (phase.value !== 'cut' || closing.value) return // « Recommencer à zéro » pendant le vol : on ne rouvre pas une lecture
  await ensureTarot()
  if (phase.value !== 'cut' || closing.value) return
  pickedPaquet.value = paquet
  prophecy.value = nextProphecy(prophecies, level.value, safeStorage(), rng, paquet)
  progress.remember(prophecy.value.arcane.numero, level.value)
  phase.value = 'reading'
  hymn()
  void nextTick(() => (tarotFailed.value ? closeBtn.value : readingEl.value)?.focus({ preventScroll: true })) // la coupe disparaît : le focus reste sur la lecture jusqu’à « Fermer la porte »
}
const leave = (count: boolean) => {
  if (closing.value) return
  closing.value = true
  unlock()
  if (count) progress.bump()
  // The open door slams first; the next variant is picked once it is shut (see onClosed).
  sceneKey.value++
  phase.value = 'door'
}
const restart = () => leave(true)

// Browsers keep the AudioContext suspended until a user gesture; without one, the first knocks would be silent.
const awaiting = ref(!navigator.userActivation?.hasBeenActive)
const { start: startAwaitEnd } = useTimeoutFn(() => (awaiting.value = false), 120, { immediate: false })
const approach = () => {
  unlock()
  requestOrientationPermission()
  // Give the context a moment to reach 'running' so scheduleKnocks sees it live.
  ensureDoor().then(startAwaitEnd, () => undefined)
}

const closeBtn = ref<HTMLButtonElement>()
const readingEl = ref<HTMLElement>()
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
  () => [phase.value, closing.value, awaiting.value, gpu.value, DoorScene.value] as const,
  ([p, c, a, g, d]) => {
    if (p === 'door' && !c && !a && g === 'ok' && d) focusSoon(() => document.querySelector<HTMLElement>('.door-hit'))
  },
  { flush: 'post' },
)
const onClosed = () => {
  enterDoor()
}
// Niveau 5 : « Fermer la porte » passe par la finale, puis reprend le chemin habituel.
const onClose = () => (level.value >= 5 ? (phase.value = 'finale') : restart())
</script>

<template>
  <WebGpuGate v-if="gpu === 'blocked'" @retry="retry" @about="openAbout" />
  <MotionConfig v-else reduced-motion="user">
    <CrtOverlay :key="attempt" :paranoia="paranoia" @ready="gpu = 'ok'" @fail="gpu = 'blocked'" />
    <p
      v-if="gpu === 'checking'"
      class="fixed inset-0 m-0 grid place-items-center text-[0.9rem] tracking-[0.1em] opacity-0 text-fg animate-[checking-in_0.6s_ease_0.4s_forwards] pointer-events-none"
      role="status"
    >
      Connexion aux ondes…
    </p>
    <template v-if="gpu === 'ok'">
      <BgPlace :key="place.id" :place="place.id" :variant="placeVariant.params" />
      <div
        class="fixed inset-0 z-0 pointer-events-none bg-[rgb(120_0_0/0.35)] transition-opacity duration-[400ms] motion-reduce:transition-none"
        :class="listening ? 'opacity-100' : 'opacity-0'"
        aria-hidden="true"
      />
      <button
        v-if="awaiting"
        class="fixed inset-0 z-20 grid place-items-center w-full border-0 bg-transparent text-fg [font-family:inherit] text-[1.2rem] tracking-[0.08em] cursor-pointer focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-fg focus-visible:outline-offset-[-0.6667rem]"
        type="button"
        autofocus
        @click="approach"
      >
        Approchez-vous de la porte
      </button>
      <main
        v-else-if="DoorScene"
        ref="mainEl"
        class="app relative z-1 min-h-[100vh] min-h-[100dvh] grid place-items-center pt-[0.75rem] px-[1rem] pb-[calc(0.75rem+var(--taskbar-h))] overflow-clip"
        :class="{ 'app--reading': phase === 'reading' || phase === 'cut' }"
      >
        <AnimatePresence mode="wait">
          <Motion
            v-if="phase === 'door'"
            :key="`door-${sceneKey}`"
            class="w-full max-w-[36rem] grid justify-items-center"
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
            class="w-full max-w-[36rem] grid justify-items-center"
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
            class="w-full max-w-[36rem] grid justify-items-center h-full min-h-0 grid-rows-[minmax(0,1fr)] [@media(orientation:landscape)_and_(max-height:32.5rem)]:max-w-[48rem]"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :transition="{ duration: 0.2 }"
          >
            <!-- Une seule structure pour la coupe et la lecture : la boîte de la carte ne change donc jamais entre les deux. -->
            <section
              ref="readingEl"
              tabindex="-1"
              class="w-full max-w-[36rem] text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation outline-none flex flex-col gap-3 items-center h-full min-h-0 [@media(orientation:landscape)_and_(max-height:32.5rem)]:flex-row [@media(orientation:landscape)_and_(max-height:32.5rem)]:gap-4"
            >
              <div class="flex-[1_1_0] min-h-0 w-full [container-type:size] grid place-items-center [@media(orientation:landscape)_and_(max-height:32.5rem)]:h-full">
                <DeckCut v-if="phase === 'cut'" :level="level" :rng="rng" @pick="onPick" />
                <div v-else-if="tarotFailed" class="max-h-full overflow-auto w-full p-4 text-left font-card [background:#f3e3b3] [color:#170a2b] [border:0.3rem_solid_#1f1038]">
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
                <button ref="closeBtn" class="btn-alt" type="button" :disabled="closing" @click="onClose">Fermer la porte</button>
              </div>
            </section>
          </Motion>
          <Motion
            v-else-if="phase === 'finale'"
            key="finale"
            class="w-full max-w-[36rem] grid justify-items-center"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :transition="{ duration: 0.2 }"
          >
            <Finale @done="restart" />
          </Motion>
        </AnimatePresence>
      </main>
    </template>
  </MotionConfig>
  <Taskbar v-if="gpu === 'ok'" :level="level" @about="openAbout" @reset="resetOpen = true" @reset-level="resetLevel" />
  <AboutTempleOS v-if="aboutWanted" v-model="aboutOpen" />
  <ResetConfirm v-if="resetWanted" v-model="resetOpen" @confirm="resetLevel" />
</template>
