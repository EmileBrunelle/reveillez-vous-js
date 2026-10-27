<script setup lang="ts">
import { computed, ref, watch, useTemplateRef, type ComponentPublicInstance } from 'vue'
import { AnimatePresence, Motion, MotionConfig } from 'motion-v'
import { storeToRefs } from 'pinia'
import CrtOverlay from './components/CrtOverlay.vue'
import WebGpuGate from './components/WebGpuGate.vue'
import TarotFallback from './components/TarotFallback.vue'
import Taskbar from './components/Taskbar.vue'
import FakeErrors from './components/FakeErrors.vue'
import BgPlace from './components/backgrounds/BgPlace.vue'
import { useProgressStore } from './stores/progress'
import { useCollectionStore } from './stores/collection'
import { isQuickKnock } from './engine/paranoia'
import { useTabTitle } from './composables/useTabTitle'
import { WAKE_LABEL } from './content/finale'
import { ACTIVITY_PROMPTS } from './content/activityPrompts'
import { createFocusOnce } from './composables/focusOnce'
import { useLazyScenes } from './composables/useLazyScenes'
import { useGameFlow } from './composables/useGameFlow'
import { useDeferredText } from './composables/useDeferredText'
import { useLazyWindow } from './composables/useLazyWindow'
import { useFocusTarget } from './composables/useFocusTarget'
import { useShake } from './composables/useShake'
import { useApproach } from './composables/useApproach'

// Focus au montage (pas d’autofocus : Chrome y montrerait l’anneau avant toute entrée) ; sans entrée connue, on le traite comme un pointeur.
// Ref fonction rappelée à chaque rendu : createFocusOnce ne focalise qu’une fois par élément (une réapparition de l’overlay = nouvel élément).
const focusOverlay = createFocusOnce()
const closeBtn = useTemplateRef<HTMLButtonElement>('closeBtn')
const readingEl = useTemplateRef<HTMLElement>('readingEl')
const activityEl = useTemplateRef<ComponentPublicInstance>('activityEl')
const finaleEl = useTemplateRef<{ focus: () => void }>('finaleEl')
const deckEl = useTemplateRef<{ focus: () => void }>('deckEl')
const doorScene = useTemplateRef<{ focus: () => void }>('doorScene')

// Phases d’une visite (porte -> activité -> coupe -> lecture -> finale) : voir useGameFlow.
const {
  rng,
  phase,
  focusTarget,
  tarotOk,
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
  activityId,
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
  skipDeck,
} = useGameFlow()

// Hors du premier écran : chargés à la demande, préchargés dès que possible (voir useLazyScenes).
const { TarotCard, DoorScene, ensureDoor, About, ResetConfirm, CollectionWindow, SoundWindow, DeckCut, Finale } = useLazyScenes({ deck: skipDeck, finale: onFinaleRestart })

// 'checking' tant que la surcouche CRT n’a pas obtenu un appareil WebGPU : rien de l’expérience ne s’affiche avant.
const gpu = ref<'checking' | 'ok' | 'blocked'>('checking')
// Le réseau sert d’abord au premier écran (CRT, vgpu) : le reste ne part qu’une fois le GPU confirmé.
watch(gpu, (g) => g === 'ok' && void ensureDoor().catch(() => undefined), { immediate: true })
const connecting = useDeferredText(() => 'Connexion aux ondes…')
const attempt = ref(0)
const retry = () => {
  gpu.value = 'checking'
  attempt.value++
}

// Fenêtres chargées à la première ouverture (voir useLazyWindow) ; seule « À propos » rend le focus à son déclencheur (les autres le font via useDialogFocus).
const { open: aboutOpen, wanted: aboutWanted, show: openAbout } = useLazyWindow({ restoreFocus: true })
const { open: soundOpen, wanted: soundWanted, show: openSound } = useLazyWindow()
const { open: collectionOpen, wanted: collectionWanted, show: openCollection } = useLazyWindow()
const { open: resetOpen, wanted: resetWanted } = useLazyWindow()

const progress = useProgressStore()
const collection = useCollectionStore()
// Remise à zéro complète (« Oublier ») : en plus du niveau, la collection est effacée.
const forgetAll = () => {
  collection.clear()
  resetLevel()
}
const { level, paranoia } = storeToRefs(progress)
useTabTitle(level)

const activityLabel = computed(() => (activityId.value ? ACTIVITY_PROMPTS[activityId.value].verb : 'Activité'))
const mainEl = useTemplateRef<HTMLElement>('mainEl')
const shake = useShake(mainEl)
const { awaiting, approach } = useApproach(() => ensureDoor())

// Un écran qui se démonte laisse le focus sur <body> : useGameFlow nomme où il doit atterrir (focusTarget), ce watcher unique le traduit en élément.
// Pas de sondage : AnimatePresence (mode wait) ne monte l’écran suivant qu’après la sortie du précédent, et sa ref passe alors de null à l’élément,
// ce qui relance le watcher. Changer de cible entre-temps annule l’attente (targetEl repart de la nouvelle cible).
useFocusTarget({
  target: focusTarget,
  refs: { door: doorScene, activity: activityEl, deck: deckEl, reading: readingEl, close: closeBtn, finale: finaleEl },
  area: mainEl,
  guarded: { target: 'close', from: readingEl },
})
watch(
  () => [phase.value, closing.value, awaiting.value, gpu.value, DoorScene.value] as const,
  ([p, c, a, g, d]) => {
    if (p === 'door' && !c && !a && g === 'ok' && d) {
      focusTarget.value = 'door'
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
    <!-- Région live présente dès le montage, vide puis remplie (sinon elle n’est pas annoncée) ; visuellement absente hors de l’attente. -->
    <p
      role="status"
      :class="
        gpu === 'checking' ? 'fixed inset-0 m-0 grid place-items-center text-[0.9rem] tracking-[0.1em] opacity-0 text-fg animate-[checking-in_0.6s_ease_0.4s_forwards] pointer-events-none' : 'sr-only'
      "
    >
      {{ gpu === 'checking' ? connecting : '' }}
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
              ref="doorScene"
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
            ref="activityEl"
            tabindex="-1"
            role="group"
            :aria-label="activityLabel"
            class="relative w-full max-w-[36rem] min-[1600px]:max-w-[90rem] h-[calc(100dvh-0.75rem-var(--pad-t)-var(--taskbar-h))] min-h-[22rem] grid outline-none"
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
              role="group"
              aria-label="Lecture"
              class="w-full max-w-[36rem] min-[1600px]:max-w-[90rem] text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation outline-none flex flex-col gap-3 items-center h-full min-h-0 [@media(orientation:landscape)_and_(max-height:32.5rem)]:flex-row [@media(orientation:landscape)_and_(max-height:32.5rem)]:gap-4"
            >
              <div class="flex-[1_1_0] min-h-0 w-full [container-type:size] grid place-items-center [@media(orientation:landscape)_and_(max-height:32.5rem)]:h-full">
                <DeckCut v-if="phase === 'cut'" ref="deckEl" :level="level" :rng="rng" @pick="onPick" />
                <TarotCard
                  v-else-if="tarotOk"
                  :arcane="prophecy.arcane"
                  :title="prophecy.question"
                  :body="prophecy.body"
                  :verse="prophecy.verse"
                  :level="level"
                  :paquet="pickedPaquet"
                  @flipped="onFlipped"
                />
                <TarotFallback v-else :title="prophecy.question" :body="prophecy.body" :verse="prophecy.verse" />
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
            <Finale ref="finaleEl" @collapsed="onCollapsed" @restart="onFinaleRestart" />
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
