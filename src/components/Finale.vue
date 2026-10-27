<script setup lang="ts">
import { computed, nextTick, onScopeDispose, onMounted, ref, watch, useTemplateRef } from 'vue'
import { Motion } from 'motion-v'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { useCollectionStore } from '../stores/collection'
import { useReducedMotion } from '../composables/useReducedMotion'
import { CREDITS_BODY, CREDITS_THANKS, CREDITS_TITLE, FINALE_GREETING, FINALE_STORY, FINALE_TITLE, README_LABEL, README_PREFIX, REPO_URL, RESTART_LABEL } from '../content/finale'
import { useRiseDirective, useTextLeave } from '../composables/useFinaleRise'
import { useFinaleBox } from '../composables/useFinaleBox'
import { useKeptAnimations } from '../composables/useKeptAnimations'
import { focusQuietly } from '../composables/focusQuietly'
import { BELL_DELAY, startFinaleAudio } from '../audio/finale'

// Finale du niveau 5 : la télé s’éteint en une ligne, l’aube se lève, le texte arrive ligne par ligne, puis le générique.
// `collapsed` : l’écran est noir (l’app coupe le CRT et passe le lieu en aube sans qu’on le voie). `restart` : « Recommencer ».
const emit = defineEmits<{ collapsed: []; restart: [] }>()
const reduced = useReducedMotion()
const collection = useCollectionStore()
// Le mouvement réduit ne coupe pas le son : sans séquence, on garde seulement la nappe d’aube et la cloche (voir onMounted).
const audio = startFinaleAudio()
onScopeDispose(() => audio.stop()) // coupe le son en fondu à la destruction (`stop` est idempotent : « passer » l’a peut-être déjà appelé)

type Step = 'pre' | 'collapse' | 'black' | 'rise' | 'text' | 'credits'
const step = ref<Step>('pre')
const lines = [...FINALE_TITLE, ...FINALE_STORY, FINALE_GREETING]
const count = ref(0)
const skipped = ref(false)
// Un seul maître par transform : motion-v (ressort) pose opacité et y, plus aucune animation CSS sur ces lignes.
// Statique d’emblée en mouvement réduit ou après un saut ; sinon chaque élément monte sur un ressort doux, après `d` secondes.
const { keep, finish: finishRunning, pending } = useKeptAnimations()
const vRise = useRiseDirective({ reduced, skipped }, keep)
// Le titre apparaît lettre par lettre : mots insécables, chaque lettre sur son ressort (retard cumulé par ligne).
// Les lignes sont des constantes : on découpe une fois à l’initialisation, pas à chaque rendu.
const letters = (l: string) => {
  let n = 0
  return l.split(' ').map((w) => [...w].map((ch) => ({ ch, d: n++ * 0.045 })))
}
const titleLetters = Object.fromEntries(FINALE_TITLE.map((l) => [l, letters(l)]))
// Retards du générique (s) : le titre, une ligne toutes les 0,2 s, une pause avant le remerciement (qui arrive en dernier), puis le compteur et « Recommencer ».
const CREDIT_STEP = 0.2
const creditDelay = (i: number) => i * CREDIT_STEP
const thanksDelay = (CREDITS_BODY.length + 2) * CREDIT_STEP + 0.3
// En mouvement réduit : pas d’animation, tout le texte et le générique sont là d’un coup.
// Mouvement réduit : la région live (role=status) est montée vide, puis remplie, pour que le texte soit annoncé.
const liveReady = ref(false)
const { start: readyLater } = useTimeoutFn(() => (liveReady.value = true), 150, { immediate: false })
const showText = computed(() => (reduced.value ? liveReady.value : step.value === 'text'))
const shown = computed(() => (reduced.value ? lines : lines.slice(0, count.value)))
const showCredits = computed(() => reduced.value || step.value === 'credits')
// Annonce du générique (titre et remerciement) ; en mouvement réduit, après le montage vide de la région (liveReady).
const creditsAnnounce = computed(() => (showCredits.value && (!reduced.value || liveReady.value) ? `${CREDITS_TITLE}. ${CREDITS_THANKS}` : ''))
const showBox = computed(() => showText.value || showCredits.value)
// Un seul conteneur pour le texte puis le générique : il entre sur un ressort (échelle + opacité) et sa hauteur suit le contenu au ressort,
// au lieu d’apparaître d’un coup plus grand. Mouvement réduit : simple fondu, hauteur posée directement.
// Un seul conteneur pour le texte puis le générique (entrée et hauteur au ressort : voir useFinaleBox).
const inner = useTemplateRef<HTMLElement>('inner')
const boxStyle = useFinaleBox(inner, { reduced, skipped }, keep)
// Le texte s’efface avant que le générique ne prenne sa place (la hauteur du conteneur se règle pendant ce temps).
const { leaveText, finishLeaving } = useTextLeave({ reduced, skipped })
// Le focus arrive sur le conteneur nommé « Finale » dès l’entrée (App.vue, via focusTarget), puis sur « Recommencer » quand il apparaît.
const rootEl = useTemplateRef<HTMLElement>('rootEl')
defineExpose({ focus: () => focusQuietly(rootEl.value, { preventScroll: true }) })
const restartBtn = useTemplateRef<HTMLButtonElement>('restartBtn')
// Le générique peut dépasser (téléphone) : « Recommencer » est ramené dans la section défilante, en douceur sauf mouvement réduit.
// Le bouton n’existe qu’une fois le générique monté (après le fondu du texte) : on agit à son montage, une fois la hauteur du conteneur posée.
const doFocus = () => {
  focusQuietly(restartBtn.value, { preventScroll: true })
  restartBtn.value?.scrollIntoView({ block: 'nearest', behavior: reduced.value ? 'auto' : 'smooth' })
}
// Délai : 700 ms (ressorts en cours), 150 ms après un saut, 500 ms en mouvement réduit.
const { start: focusLater, stop: focusStop } = useTimeoutFn(doFocus, () => (reduced.value ? 500 : skipped.value ? 150 : 700), { immediate: false })
watch(restartBtn, (el) => {
  if (!el) return
  focusStop()
  focusLater()
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
    void nextTick(readyLater)
    emit('collapsed')
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
    skipped.value = true
    // Générique déjà là : un clic ailleurs mène seulement les ressorts restants à leur fin (le lien, lui, n’y touche jamais).
    finishLeaving() // fondu du texte en cours : le générique apparaît tout de suite
    if (pending()) finishRunning()
    return
  }
  stop()
  skipped.value = true
  finishRunning() // mène les ressorts à leur fin (stop() seul les figerait à mi-course)
  audio.stop(false) // coupe nappe et cloche en fondu, sans oscillateur orphelin ; le générique reste silencieux comme en fin normale
  if (step.value === 'pre' || step.value === 'collapse') emit('collapsed') // l’aube doit quand même se mettre en place
  count.value = lines.length
  step.value = 'credits'
}
// Clic ou toucher n’importe où, ou Espace/Entrée ; un bouton (« Recommencer », barre des tâches) garde son propre comportement.
const onButton = (e: Event) => e.target instanceof Element && !!e.target.closest('button, a, [role="menuitem"]')
useEventListener(document, 'click', (e) => onButton(e) || skip())
useEventListener(document, 'keydown', (e) => (e.key === ' ' || e.key === 'Enter') && !onButton(e) && skip())
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
    ref="rootEl"
    class="w-full max-w-[34rem] max-h-[calc(100dvh-0.75rem-var(--pad-t)-var(--taskbar-h))] overflow-auto grid gap-3 justify-items-center text-center text-white outline-none [text-shadow:0_0_0.7rem_rgb(25_8_40/0.95),0_0.05rem_0.15rem_rgb(25_8_40/0.9)]"
    tabindex="-1"
    aria-label="Finale"
  >
    <!-- Région live persistante, vide jusqu’au générique : un rôle status inséré déjà plein serait muet. -->
    <p class="sr-only" role="status">{{ creditsAnnounce }}</p>
    <Motion v-if="showBox" as="div" class="w-full overflow-hidden rounded-lg bg-[rgb(25_8_40/0.6)]" :style="boxStyle">
      <div ref="inner" class="grid gap-3 justify-items-center px-4 py-5">
        <Transition :css="false" mode="out-in" @leave="leaveText">
          <div :key="reduced ? 'all' : step" class="grid gap-3 justify-items-center">
            <!-- Région live à ajouts seulement : chaque ligne qui arrive est annoncée seule, pas le texte cumulé. -->
            <div v-if="showText" class="grid gap-3 justify-items-center" role="status" aria-atomic="false" aria-relevant="additions">
              <template v-for="(l, i) in shown" :key="l">
                <p v-if="i < FINALE_TITLE.length" class="m-0" :class="lineClass(i)">
                  <span class="sr-only">{{ l }}</span>
                  <template v-for="(w, wi) in titleLetters[l]" :key="wi">
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
                }}<a class="linklike focus-visible:[outline-color:#fff]" :href="`${REPO_URL}#readme`" target="_blank" rel="noopener noreferrer"
                  >{{ README_LABEL }}<span class="sr-only"> (nouvel onglet)</span></a
                >
              </p>
              <p v-rise="{ d: thanksDelay }" class="m-0 font-card text-[1.05rem] leading-snug">{{ CREDITS_THANKS }}</p>
              <p v-rise="{ d: thanksDelay + CREDIT_STEP }" class="m-0 font-card text-[1.05rem] leading-snug">Arcanes révélés : {{ collection.count }} sur {{ collection.total }}</p>
              <button ref="restartBtn" v-rise="{ d: thanksDelay + 2 * CREDIT_STEP, y: 0 }" class="btn mt-2" type="button" @click="emit('restart')">{{ RESTART_LABEL }}</button>
            </div>
          </div>
        </Transition>
      </div>
    </Motion>
  </section>
</template>
