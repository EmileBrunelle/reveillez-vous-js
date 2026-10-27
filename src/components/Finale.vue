<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Directive } from 'vue'
import { animate } from 'motion-v'
import { useEventListener, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import { useCollectionStore } from '../stores/collection'
import { useReducedMotion } from '../composables/useReducedMotion'
import { CREDITS_BODY, CREDITS_THANKS, CREDITS_TITLE, FINALE_GREETING, FINALE_STORY, FINALE_TITLE, README_LABEL, README_PREFIX, REPO_URL, RESTART_LABEL } from '../content/finale'
import { focusQuietly } from '../composables/focusQuietly'
import { BELL_DELAY, startFinaleAudio } from '../audio/finale'
import { finishAnimations, type Stoppable } from '../composables/finishAnimations'

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
const skipped = ref(false)
// Un seul maître par transform : motion-v (ressort) pose opacité et y, plus aucune animation CSS sur ces lignes.
// Statique d’emblée en mouvement réduit ou après un saut ; sinon chaque élément monte sur un ressort doux, après `d` secondes.
let running: Stoppable[] = []
const vRise: Directive<HTMLElement, { d?: number; y?: number; letter?: boolean; soft?: boolean }> = {
  beforeMount(el) {
    if (!reduced.value && !skipped.value) el.style.opacity = '0'
  },
  mounted(el, { value }) {
    if (reduced.value || skipped.value) return
    const y = value.y ?? 16
    const spring = value.letter ? { stiffness: 240, damping: 15 } : value.soft ? { stiffness: 36, damping: 13 } : { stiffness: 80, damping: 17 }
    const a = animate(el, { opacity: [0, 1], ...(y ? { y: [y, 0] } : {}) } as never, { type: 'spring', ...spring, delay: value.d ?? 0 } as never)
    running.push(a)
    void Promise.resolve(a).then(
      () => (running = running.filter((r) => r !== a)),
      () => undefined,
    )
  },
}
// Le titre apparaît lettre par lettre : mots insécables, chaque lettre sur son ressort (retard cumulé par ligne).
const letters = (l: string) => {
  let n = 0
  return l.split(' ').map((w) => [...w].map((ch) => ({ ch, d: n++ * 0.045 })))
}
// Retards du générique (s) : le titre, une ligne toutes les 0,2 s, une pause avant le remerciement (qui arrive en dernier), puis le compteur et « Recommencer ».
const CREDIT_STEP = 0.2
const creditDelay = (i: number) => i * CREDIT_STEP
const thanksDelay = (CREDITS_BODY.length + 2) * CREDIT_STEP + 0.3
// En mouvement réduit : pas d’animation, tout le texte et le générique sont là d’un coup.
const showText = computed(() => reduced.value || step.value === 'text')
const shown = computed(() => (reduced.value ? lines : lines.slice(0, count.value)))
const showCredits = computed(() => reduced.value || step.value === 'credits')
const showBox = computed(() => showText.value || showCredits.value)
// Un seul conteneur pour le texte puis le générique : il entre sur un ressort (échelle + opacité) et sa hauteur suit le contenu au ressort,
// au lieu d’apparaître d’un coup plus grand. Mouvement réduit : simple fondu, hauteur posée directement.
const box = ref<HTMLElement>()
const inner = ref<HTMLElement>()
let boxIn = false
let heightAnim: Stoppable | undefined
const keep = (a: Stoppable) => {
  running.push(a)
  void Promise.resolve(a).then(
    () => (running = running.filter((r) => r !== a)),
    () => undefined,
  )
}
useResizeObserver(inner, () => {
  const el = box.value
  const h = inner.value?.offsetHeight
  if (!el || !h) return
  if (!boxIn) {
    boxIn = true
    el.style.height = `${h}px`
    if (skipped.value) return void (el.style.opacity = '1')
    keep(
      animate(
        el,
        { opacity: [0, 1], ...(reduced.value ? {} : { scale: [0.94, 1], y: [14, 0] }) } as never,
        reduced.value ? ({ duration: 0.6, ease: 'easeOut' } as never) : ({ type: 'spring', stiffness: 70, damping: 16 } as never),
      ),
    )
    return
  }
  if (reduced.value || skipped.value) return void (el.style.height = `${h}px`)
  heightAnim?.stop?.()
  heightAnim = animate(el, { height: h } as never, { type: 'spring', stiffness: 90, damping: 20 } as never)
  keep(heightAnim)
})
// Le texte s’efface avant que le générique ne prenne sa place (la hauteur du conteneur se règle pendant ce temps).
const leaveText = (el: Element, done: () => void) => {
  if (reduced.value || skipped.value) return done()
  const a = animate(el as HTMLElement, { opacity: 0 } as never, { duration: 0.45, ease: 'easeIn' } as never)
  void Promise.resolve(a).then(done, done)
}
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
  if (reduced.value) return
  if (step.value === 'credits') {
    // Générique déjà là : un clic ailleurs mène seulement les ressorts restants à leur fin (le lien, lui, n’y touche jamais).
    if (running.length) {
      skipped.value = true
      finishAnimations(running)
      running = []
    }
    return
  }
  stop()
  skipped.value = true
  finishAnimations(running) // mène les ressorts à leur fin (stop() seul les figerait à mi-course)
  running = []
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
  finishAnimations(running)
  running = []
  audio.stop()
})
const barsClosed = computed(() => step.value !== 'pre')
const lineOut = computed(() => ['black', 'rise', 'text', 'credits'].includes(step.value))
const veilLifted = computed(() => ['rise', 'text', 'credits'].includes(step.value))
const lineClass = (i: number) =>
  i < FINALE_TITLE.length ? 'font-title text-[1.7rem] tracking-[0.06em]' : i === lines.length - 1 ? 'font-title text-[1.4rem] tracking-[0.12em]' : 'font-card text-[1.2rem] leading-snug'
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
    class="w-full max-w-[34rem] max-h-[calc(100dvh-0.75rem-var(--pad-t)-var(--taskbar-h))] overflow-auto grid gap-3 justify-items-center text-center text-white [text-shadow:0_0_0.7rem_rgb(25_8_40/0.95),0_0.05rem_0.15rem_rgb(25_8_40/0.9)]"
    aria-label="Finale"
  >
    <div v-if="showBox" ref="box" class="w-full overflow-hidden rounded-lg bg-[rgb(25_8_40/0.6)]" style="height: 0; opacity: 0">
      <div ref="inner" class="grid gap-3 justify-items-center px-4 py-5">
        <Transition :css="false" mode="out-in" @leave="leaveText">
          <div :key="reduced ? 'all' : step" class="grid gap-3 justify-items-center">
            <div v-if="showText" class="grid gap-3 justify-items-center" role="status">
              <template v-for="(l, i) in shown" :key="l">
                <p v-if="i < FINALE_TITLE.length" class="m-0" :class="lineClass(i)" :aria-label="l">
                  <template v-for="(w, wi) in letters(l)" :key="wi">
                    <span class="inline-block whitespace-nowrap" aria-hidden="true"
                      ><span v-for="(c, ci) in w" :key="ci" v-rise="{ d: c.d, y: 10, letter: true }" class="inline-block">{{ c.ch }}</span></span
                    >{{ ' ' }}
                  </template>
                </p>
                <template v-else-if="i === lines.length - 1">
                  <!-- Le salut : une courte pause (filet) après le récit, puis « Bonjour. » à l’heure de la cloche, sur un ressort lent. -->
                  <span v-rise="{ y: 0, d: BELL_DELAY - 0.1 }" class="mt-2 h-px w-10 bg-white/50" aria-hidden="true" />
                  <p v-rise="{ d: BELL_DELAY, y: 6, soft: true }" class="m-0" :class="lineClass(i)">{{ l }}</p>
                </template>
                <p v-else v-rise="{}" class="m-0" :class="lineClass(i)">{{ l }}</p>
              </template>
            </div>
            <div v-if="showCredits" class="grid gap-3 justify-items-center">
              <h2 v-rise="{ d: creditDelay(0) }" class="font-title m-0 text-[1.6rem] tracking-[0.06em]">{{ CREDITS_TITLE }}</h2>
              <p v-for="(c, ci) in CREDITS_BODY" :key="c" v-rise="{ d: creditDelay(ci + 1) }" class="m-0 font-card text-[1.05rem] leading-snug">{{ c }}</p>
              <p v-rise="{ d: creditDelay(CREDITS_BODY.length + 1) }" class="m-0 font-card text-[1.05rem] leading-snug">
                {{ README_PREFIX
                }}<a class="linklike focus-visible:[outline-color:#fff]" :href="`${REPO_URL}#readme`" target="_blank" rel="noopener noreferrer" aria-label="README sur GitHub (nouvel onglet)">{{
                  README_LABEL
                }}</a>
              </p>
              <p v-rise="{ d: thanksDelay }" class="m-0 font-card text-[1.05rem] leading-snug">{{ CREDITS_THANKS }}</p>
              <p v-rise="{ d: thanksDelay + CREDIT_STEP }" class="m-0 font-card text-[1.05rem] leading-snug">Arcanes révélés : {{ collection.count }} sur {{ collection.total }}</p>
              <button ref="restartBtn" v-rise="{ d: thanksDelay + 2 * CREDIT_STEP, y: 0 }" class="btn mt-2" type="button" @click="emit('restart')">{{ RESTART_LABEL }}</button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>
