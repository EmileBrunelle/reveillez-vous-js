<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { useCollectionStore } from '../stores/collection'
import { useReducedMotion } from '../composables/useReducedMotion'
import { CREDITS, CREDITS_TITLE, FINALE_GREETING, FINALE_STORY, FINALE_TITLE, RESTART_LABEL } from '../content/finale'
import { focusQuietly } from '../composables/focusQuietly'
import { startFinaleAudio } from '../audio/finale'

// Finale du niveau 5 : la télé s’éteint en une ligne, l’aube se lève, le texte arrive ligne par ligne, puis le générique.
// `collapsed` : l’écran est noir (l’app coupe le CRT et passe le lieu en aube sans qu’on le voie). `restart` : « Recommencer ».
const emit = defineEmits<{ collapsed: []; restart: [] }>()
const reduced = useReducedMotion()
const collection = useCollectionStore()
// Le mouvement réduit ne coupe pas le son : sans séquence, on garde seulement la nappe d’aube et la cloche (voir onMounted).
const audio = startFinaleAudio()

type Step = 'pre' | 'collapse' | 'black' | 'rise' | 'text' | 'credits'
const step = ref<Step>('pre')
const lines = [...FINALE_TITLE, ...FINALE_STORY, FINALE_GREETING]
const count = ref(0)
// En mouvement réduit : pas d’animation, tout le texte et le générique sont là d’un coup.
const showText = computed(() => reduced.value || step.value === 'text')
const shown = computed(() => (reduced.value ? lines : lines.slice(0, count.value)))
const showCredits = computed(() => reduced.value || step.value === 'credits')
const restartBtn = ref<HTMLButtonElement>()
// Le générique peut dépasser (téléphone) : « Recommencer » est ramené dans la section défilante, en douceur sauf mouvement réduit.
const focusRestart = () =>
  void nextTick(() => {
    focusQuietly(restartBtn.value, { preventScroll: true })
    restartBtn.value?.scrollIntoView({ block: 'nearest', behavior: reduced.value ? 'auto' : 'smooth' })
  })

// Un seul changement spatial, jamais de scintillement : barres noires qui se ferment (1,1 s), une ligne, puis le noir ; l’aube remonte en 4 s.
const delay = ref(50)
const { start, stop } = useTimeoutFn(
  () => {
    const s = step.value
    if (s === 'pre') {
      ;[step.value, delay.value] = ['collapse', 1500]
      audio.powerDown()
    } else if (s === 'collapse') {
      ;[step.value, delay.value] = ['black', 800]
      emit('collapsed')
    } else if (s === 'black') {
      ;[step.value, delay.value] = ['rise', 2500]
      audio.dawn()
    } else if (s === 'rise') {
      ;[step.value, delay.value] = ['text', 1800]
      count.value = 1
    } else if (s === 'text') {
      if (count.value >= lines.length) {
        step.value = 'credits'
        audio.fadePad()
        focusRestart()
        return
      }
      count.value++
      if (count.value === lines.length) audio.bell()
      delay.value = count.value === lines.length ? 4200 : count.value <= FINALE_TITLE.length ? 2200 : 3400
    }
    start()
  },
  delay,
  { immediate: false },
)
const { start: fadeLater } = useTimeoutFn(() => audio.fadePad(), 5000, { immediate: false })
onMounted(() => {
  if (reduced.value) {
    emit('collapsed')
    focusRestart()
    audio.dawn()
    audio.bell()
    fadeLater()
  } else start()
})
// Passer la séquence : tout le reste (texte, générique, « Recommencer ») apparaît d’un coup.
const skip = () => {
  // En mouvement réduit tout est déjà affiché : rien à passer (et la nappe continue).
  if (step.value === 'credits' || reduced.value) return
  stop()
  audio.stop(false) // coupe nappe et cloche en fondu, sans oscillateur orphelin ; le générique reste silencieux comme en fin normale
  if (step.value === 'pre' || step.value === 'collapse') emit('collapsed') // l’aube doit quand même se mettre en place
  count.value = lines.length
  step.value = 'credits'
  focusRestart()
}
// Clic ou toucher n’importe où, ou Espace/Entrée ; un bouton (« Recommencer », barre des tâches) garde son propre comportement.
const onButton = (e: Event) => e.target instanceof Element && !!e.target.closest('button, a, [role="menuitem"]')
useEventListener(document, 'click', (e) => onButton(e) || skip())
useEventListener(document, 'keydown', (e) => (e.key === ' ' || e.key === 'Enter') && !onButton(e) && skip())
onBeforeUnmount(() => {
  stop()
  audio.stop()
})
const barsClosed = computed(() => step.value !== 'pre')
const lineOut = computed(() => ['black', 'rise', 'text', 'credits'].includes(step.value))
const veilLifted = computed(() => ['rise', 'text', 'credits'].includes(step.value))
const lineClass = (i: number) => (i < FINALE_TITLE.length ? 'font-title text-[1.7rem] tracking-[0.06em]' : i === lines.length - 1 ? 'font-title text-[2rem]' : 'font-card text-[1.2rem] leading-snug')
</script>

<template>
  <!-- Le voile est sous le contenu (z négatif) et ne capte jamais le pointeur : les boutons restent utilisables pendant les effets. -->
  <div v-if="!reduced" class="fixed inset-0 -z-1 pointer-events-none transition-opacity duration-[4000ms] ease-out" :class="veilLifted ? 'opacity-0' : 'opacity-100'" aria-hidden="true">
    <div class="absolute inset-x-0 top-0 h-1/2 bg-black transition-transform duration-[1100ms] ease-in" :class="barsClosed ? 'translate-y-0' : '-translate-y-full'" />
    <div class="absolute inset-x-0 bottom-0 h-1/2 bg-black transition-transform duration-[1100ms] ease-in" :class="barsClosed ? 'translate-y-0' : 'translate-y-full'" />
    <div
      class="absolute left-0 right-0 top-1/2 h-[3px] -mt-[1px] bg-white [box-shadow:0_0_0.9rem_0.2rem_rgb(255_255_255/0.7)] transition-[opacity,transform] ease-out"
      :class="lineOut ? 'opacity-0 scale-x-0 duration-500' : barsClosed ? 'opacity-100 scale-x-100 duration-300 delay-[800ms]' : 'opacity-0 scale-x-100 duration-0'"
    />
  </div>
  <section
    class="w-full max-w-[34rem] max-h-[calc(100dvh-1.5rem-var(--taskbar-h))] overflow-auto grid gap-3 justify-items-center text-center text-white [text-shadow:0_0_0.7rem_rgb(25_8_40/0.95),0_0.05rem_0.15rem_rgb(25_8_40/0.9)]"
    aria-label="Finale"
  >
    <p v-if="!showCredits" class="m-0 font-ui text-[0.95rem] opacity-70">Toucher pour tout afficher</p>
    <div v-if="showText" class="grid gap-3 justify-items-center rounded-lg px-4 py-5 bg-[rgb(25_8_40/0.4)]" role="status">
      <p v-for="(l, i) in shown" :key="l" class="m-0 finale-line" :class="lineClass(i)">{{ l }}</p>
    </div>
    <div v-if="showCredits" class="grid gap-3 justify-items-center rounded-lg px-4 py-5 bg-[rgb(25_8_40/0.5)] finale-line">
      <h2 class="font-title m-0 text-[1.6rem] tracking-[0.06em]">{{ CREDITS_TITLE }}</h2>
      <p v-for="c in CREDITS" :key="c" class="m-0 font-card text-[1.05rem] leading-snug">{{ c }}</p>
      <p class="m-0 font-card text-[1.05rem] leading-snug">Arcanes révélés : {{ collection.count }} sur {{ collection.total }}</p>
      <button ref="restartBtn" class="btn mt-2" type="button" @click="emit('restart')">{{ RESTART_LABEL }}</button>
    </div>
  </section>
</template>

<style scoped>
.finale-line {
  animation: finale-in 1.4s ease both;
}
@keyframes finale-in {
  from {
    opacity: 0;
    transform: translateY(0.4rem);
  }
}
@media (prefers-reduced-motion: reduce) {
  .finale-line {
    animation: none;
  }
}
</style>
