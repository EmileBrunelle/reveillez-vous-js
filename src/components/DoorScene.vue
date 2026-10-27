<script setup lang="ts">
import { useDocumentVisibility, useVibrate } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { animate } from 'motion-v'
import { useReducedMotion } from '../composables/useReducedMotion'
import type { SceneVariant } from '../content/scenes'
import { creak, knock, scheduleKnocks, slam, unlock, type KnockHandle } from '../audio/sfx'
import { knockIntensity } from '../engine/knock'
import { judge, rhythmFor, toOffsets, type Gap, type Verdict } from '../engine/rhythm'
import { nextEntrezLine, nextFailLine } from '../engine/prophecy'
import { prophecies } from '../content/prophecies'
import { useKeyboardModality } from '../composables/useKeyboardModality'
import { requestOrientationPermission } from '../composables/useTilt'
import { safeStorage } from '../composables/safeStorage'
import { secureRng } from '../engine/rng'
import { useSessionStore } from '../stores/session'
import Seer from '~icons/rvj/voyante'
import SparkPool from './SparkPool.vue'
import KnockPattern from './KnockPattern.vue'

const props = defineProps<{ door: SceneVariant; line: string; level: number; closing?: boolean; quick?: boolean }>()
const emit = defineEmits<{ open: []; about: []; reset: []; resetLevel: []; impact: [number]; knocked: []; closed: []; listening: [boolean] }>()
// Visite de rappel : un seul toucher ouvre la porte (rituel déjà réussi plus tôt dans la session). Fixé au montage.
const quick = props.quick === true
const reduced = useReducedMotion()
const keyboard = useKeyboardModality()
const visibility = useDocumentVisibility()
const { vibrate: buzz } = useVibrate()
// Le haptique n’est pas du mouvement (aide au jeu muet) : pas bloqué par « mouvement réduit », seulement onglet caché.
const haptic = (ms: number) => {
  if (visibility.value !== 'hidden') buzz(ms)
}

const stage = ref<HTMLElement>()
const leaf = ref<HTMLElement>()
const glow = ref<HTMLElement>()
const spill = ref<HTMLElement>()
const seer = ref<HTMLElement>()
const dustLayer = ref<HTMLElement>()
const strip = ref<HTMLElement>()
const ui = ref<HTMLElement>()
const sparks = ref<InstanceType<typeof SparkPool>>()
const captionLayer = ref<HTMLElement>()
const CAPTIONS = 4

type State = 'idle' | 'opening' | 'gone'
let state: State = 'idle'
const isGone = () => state === 'gone'
let knocks: KnockHandle | null = null
let timers: number[] = []
let running: { stop: () => void }[] = []
let dustAt = 0
const DUST = 10
const OPEN_DEG = 72

const go = (el: Element | NodeListOf<Element> | undefined | null, kf: Record<string, unknown>, opt: Record<string, unknown> = {}) => {
  if (!el) return Promise.resolve()
  const c = animate(el, kf as never, opt as never)
  running.push(c)
  return Promise.resolve(c).catch(() => undefined)
}
const snap = (el: Element | NodeListOf<Element> | undefined | null, kf: Record<string, unknown>) => go(el, kf, { duration: 0 })
const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))
const halt = () => {
  knocks?.cancel()
  clearTimeout(silence)
  timers.forEach(clearTimeout)
  timers = []
  running.forEach((r) => r.stop())
  running = []
}

const dust = (n: number) => {
  const layer = dustLayer.value
  if (!layer || reduced.value) return
  const w = layer.offsetWidth
  Array.from({ length: n }).forEach(() => {
    const el = layer.children[dustAt++ % DUST] as HTMLElement
    const x = Math.random() * w
    go(el, { x: [x, x + (Math.random() - 0.5) * 24], y: [0, 40 + Math.random() * 80], opacity: [0.9, 0] }, { duration: 0.6 + Math.random() * 0.6, ease: 'easeIn' })
  })
}

/** Bascule la porte sous un coup de la voyante ou du joueur. */
const jitter = (intensity: number) => {
  const el = leaf.value
  if (!el || reduced.value) return
  const dir = Math.random() < 0.5 ? -1 : 1
  const amp = 2 + 5 * intensity
  snap(el, { x: dir * amp, rotateZ: dir * (0.6 + 1.4 * intensity) })
  go(el, { x: 0, rotateZ: 0 }, { type: 'spring', stiffness: 700, damping: 11 })
  const handles = el.querySelectorAll('.door-handle')
  if (handles.length) {
    snap(handles, { rotate: 25 * dir })
    go(handles, { rotate: 0 }, { type: 'spring', stiffness: 500, damping: 6 })
  }
  dust(2 + Math.round(intensity * 4))
}

/** Coup de la voyante, de l’intérieur : le battant pousse vers nous (charnière + léger zoom), poussière du cadre et filet de lumière sous la porte. */
let lastJolt = 0
const jitterInside = (intensity: number) => {
  const el = leaf.value
  if (!el || reduced.value) return
  // Rafale au retour d’un onglet caché : un seul sursaut, pas une pile d’animations.
  const t = performance.now()
  if (t - lastJolt < 90) return
  lastJolt = t
  snap(el, { rotateY: -(1.5 + 2.5 * intensity), scale: 1.012, x: 0 })
  go(el, { rotateY: 0, scale: 1 }, { type: 'spring', stiffness: 600, damping: 12 })
  dust(2 + Math.round(intensity * 2))
  // Seul changement de luminance : filet mince (≈2 px), delta modeste.
  snap(strip.value, { opacity: 0.55 })
  go(strip.value, { opacity: 0 }, { duration: 0.18, ease: 'easeOut' })
}

const session = useSessionStore()
const intensity = () => knockIntensity(props.level)
const playerKnock = (e: MouseEvent) => {
  session.pulse(0.6)
  unlock()
  haptic(20)
  knock(intensity())
  jitter(intensity())
  const r = stage.value?.getBoundingClientRect()
  const keyboard = e.detail === 0 || (e.clientX === 0 && e.clientY === 0)
  if (keyboard && r) sparks.value?.emit(r.left + r.width / 2, r.top + r.height / 2)
  else sparks.value?.emit(e.clientX, e.clientY)
}

const caption = (i: number) => {
  const layer = captionLayer.value
  const el = layer?.children[i % CAPTIONS] as HTMLElement | undefined
  if (!el) return
  const side = i % 2 ? 1 : -1
  const dx = side * ((stage.value?.offsetWidth ?? 120) * 0.55 + 10)
  if (reduced.value) go(el, { x: dx, y: 0, opacity: [1, 0] }, { duration: 0.5 })
  else go(el, { x: [dx, dx + side * 8], y: [0, -22], scale: [0.6, 1.1], opacity: [1, 0] }, { duration: 0.55, ease: 'easeOut' })
}

type Phase = 'invite' | 'listen' | 'repeat' | 'busy'
const phase = ref<Phase>('invite')
const texts = (key: string) => (Array.isArray(prophecies[key]) ? (prophecies[key] as unknown[]).filter((t): t is string => typeof t === 'string') : [])
const ghosts = computed(() => ['(Cognez à la porte)', props.line, ...texts(`rate${props.level}`), ...texts('entrez')])
watch(phase, (p) => emit('listening', p === 'listen'))
const said = ref(quick ? props.line : '(Cognez à la porte)')
const verdictText = ref('')
// Invite sans geste depuis ~3 s : on souffle que la porte se touche (respiration lente + ligne d’aide).
const nudge = ref(false)
let nudgeTimer = 0
const stopNudge = () => {
  clearTimeout(nudgeTimer)
  nudge.value = false
}
const hint = computed(() => {
  if (verdictText.value) return verdictText.value
  if (phase.value === 'listen') return 'Ça cogne de l’intérieur…'
  if (phase.value === 'repeat') return 'Touchez la porte : un coup par point.'
  if (phase.value === 'invite' && (nudge.value || quick)) return quick ? 'Touchez la porte pour l’ouvrir.' : 'Touchez la porte pour cogner.'
  return ''
})
const announce = ref('')
const pattern = ref<Gap[]>([])
const lit = ref(0)
const filled = ref(0)
let fails = 0
let taps: number[] = []
let silence = 0
let started = false
let firstListen = true
let retryIntro = ''

const VERDICTS: Record<Exclude<Verdict, 'ok'>, string> = {
  'trop-peu': 'Pas assez de coups.',
  trop: 'Trop de coups.',
  rythme: 'Le bon nombre de coups, mais pas le bon rythme.',
}
const describe = (gaps: Gap[]) => gaps.reduce((acc, g) => acc + (g === 'long' ? ', pause, toc' : ' toc'), 'toc')

const startListen = () => {
  if (state !== 'idle') return
  phase.value = 'listen'
  lit.value = 0
  filled.value = 0
  taps = []
  if (pattern.value.length === 0) pattern.value = rhythmFor(props.level, secureRng())
  const intro = firstListen ? `${props.line} — ` : retryIntro
  retryIntro = ''
  if (firstListen) said.value = props.line
  firstListen = false
  announce.value = `${intro}Ça cogne de l’intérieur : ${describe(pattern.value)}`
  knocks = scheduleKnocks(toOffsets(pattern.value, props.level), intensity(), seerHit)
}

const seerHit = (i: number, force: number) => {
  session.pulse(1)
  lit.value = i + 1
  jitterInside(force)
  caption(i)
  haptic(30)
  // Laisse le dernier point allumé un instant avant de passer la main au joueur.
  if (i >= pattern.value.length) {
    void wait(300).then(() => {
      if (state !== 'idle') return
      phase.value = 'repeat'
      announce.value = 'À vous de cogner.'
    })
  }
}

const evaluate = () => {
  clearTimeout(silence)
  if (phase.value !== 'repeat') return
  phase.value = 'busy'
  const v = judge(pattern.value, taps)
  if (v === 'ok') {
    verdictText.value = 'Bien.'
    announce.value = 'Bien. La porte s’ouvre.'
    emit('knocked')
    void wait(350).then(open)
    return
  }
  fails++
  const store = safeStorage()
  verdictText.value = VERDICTS[v]
  if (fails >= 3) {
    said.value = nextEntrezLine(prophecies, store, secureRng(), 'Entrez.')
    announce.value = said.value
    void wait(1800).then(open)
    return
  }
  said.value = nextFailLine(prophecies, props.level, store, secureRng(), 'Pas tout à fait. Écoutez encore.')
  retryIntro = `${VERDICTS[v]} ${said.value} — `
  announce.value = ''
  void wait(1600).then(() => {
    verdictText.value = ''
    startListen()
  })
}

const onDoor = (e: MouseEvent) => {
  requestOrientationPermission() // repli iOS : no-op si déjà accordé/refusé
  if (state === 'opening') return finish()
  if (state !== 'idle') return
  if (phase.value === 'invite') {
    stopNudge()
    playerKnock(e)
    if (quick) {
      // Un seul coup, la porte réagit tout de suite (secousse + étincelles), puis elle s’ouvre.
      started = true
      announce.value = 'La porte s’ouvre.'
      void wait(450).then(open)
    } else if (!started) {
      started = true
      void wait(800).then(startListen)
    }
  } else if (phase.value === 'repeat') {
    taps.push(performance.now())
    filled.value = Math.min(taps.length, pattern.value.length + 1)
    playerKnock(e)
    clearTimeout(silence)
    if (taps.length > pattern.value.length + 1) evaluate()
    else silence = window.setTimeout(evaluate, 1200)
  }
}
const onDoorKeydown = (e: KeyboardEvent) => {
  if (e.repeat) e.preventDefault()
}
// Évite la sélection de texte par clics multiples.
const onDoorMousedown = (e: MouseEvent) => {
  if (e.detail > 1) e.preventDefault()
}

onMounted(() => {
  if (props.closing) return void slamShut()
  go(ui.value, { opacity: [0, 1] }, { duration: 0.3 })
  nudgeTimer = window.setTimeout(() => (nudge.value = true), 3000)
})
onUnmounted(() => {
  clearTimeout(nudgeTimer)
  halt()
})

const open = async () => {
  if (state === 'opening') return finish()
  if (state !== 'idle') return
  state = 'opening'
  unlock()
  halt()
  snap(leaf.value, { x: 0, rotateZ: 0 })
  creak()
  if (reduced.value) {
    go(leaf.value, { opacity: 0 }, { duration: 0.2 })
    go(glow.value, { opacity: 1 }, { duration: 0.2 })
    go(seer.value, { opacity: 1 }, { duration: 0.2 })
    await wait(400)
    return finish()
  }
  go(leaf.value, { rotateY: OPEN_DEG }, { duration: 0.75, ease: [0.3, 0, 0.2, 1] })
  go(glow.value, { opacity: [0, 1] }, { duration: 0.5 })
  go(spill.value, { opacity: [0, 1], scaleX: [0.1, 1], scaleY: [0.2, 1] }, { duration: 0.7, ease: 'easeOut' })
  go(seer.value, { opacity: [0, 1], y: [10, 0], scale: [0.9, 1] }, { duration: 0.4, delay: 0.3 })
  await wait(750)
  if (state !== 'opening') return
  go(ui.value, { opacity: 0 }, { duration: 0.2 })
  go(stage.value, { scale: 2.6 }, { duration: 0.4, ease: [0.5, 0, 0.9, 0.5] })
  await wait(400)
  finish()
}

const finish = () => {
  if (state === 'gone') return
  state = 'gone'
  halt()
  emit('open')
}

const slamShut = async () => {
  state = 'opening'
  const full = reduced.value
  if (full) snap(leaf.value, { opacity: 0 })
  else snap(leaf.value, { rotateY: OPEN_DEG })
  snap(glow.value, { opacity: 1 })
  snap(spill.value, { opacity: 1 })
  snap(seer.value, { opacity: 1 })
  await wait(250)
  if (isGone()) return
  if (!full) await go(leaf.value, { rotateY: -4 }, { duration: 0.14, ease: [0.6, 0, 1, 1] })
  if (isGone()) return
  slam()
  emit('impact', 1)
  dust(8)
  go(glow.value, { opacity: 0 }, { duration: 0.1 })
  go(spill.value, { opacity: 0 }, { duration: 0.1 })
  go(seer.value, { opacity: 0 }, { duration: 0.1 })
  if (full) go(leaf.value, { opacity: 1 }, { duration: 0.15 })
  else go(leaf.value, { rotateY: 0 }, { type: 'spring', stiffness: 500, damping: 9 })
  await wait(550)
  closed()
}

const closed = () => {
  if (state === 'gone') return
  state = 'gone'
  halt()
  emit('closed')
}

const onSceneClick = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button')) return
  if (props.closing) closed()
  else if (state === 'opening') finish()
}
</script>

<template>
  <section
    class="scene grid-rows-[minmax(0,1fr)_auto] [--stage-cap:clamp(10rem,45dvh,28rem)] max-sm:portrait:[--stage-cap:clamp(10rem,54dvh,30rem)] h-[min(calc(100dvh_-_var(--taskbar-h)_-_1.5rem),calc(var(--stage-cap)_+_11rem))]"
    @click="onSceneClick"
  >
    <div
      ref="stage"
      data-stage
      class="relative w-auto h-full max-h-[var(--stage-cap)] self-end aspect-[120/190] [perspective:900px] origin-[50%_45%] select-none [-webkit-tap-highlight-color:transparent]"
    >
      <div class="absolute inset-0" aria-hidden="true">
        <div
          ref="glow"
          class="absolute inset-[1.5px] opacity-0 [mask-size:100%_100%] [mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [-webkit-mask-repeat:no-repeat] [background:radial-gradient(ellipse_at_50%_60%,#fff6c8_0%,#ffd56a_45%,#7a4a10_100%)]"
          :style="{ maskImage: `url('${door.mask}')`, WebkitMaskImage: `url('${door.mask}')` }"
        />
        <div ref="seer" class="absolute left-1/2 bottom-0 w-[38%] -ml-[19%] opacity-0 [&_.seer]:block [&_.seer]:w-full"><Seer class="seer" /></div>
      </div>
      <div
        ref="spill"
        class="absolute -left-[45%] -right-[45%] top-[60%] h-[80%] opacity-0 origin-[50%_0] [clip-path:polygon(33%_0,67%_0,100%_100%,0_100%)] [background:linear-gradient(to_bottom,rgb(255_226_140/0),rgb(255_226_140/0.6)_14%,rgb(255_226_140/0))] blur-[7px] pointer-events-none"
        aria-hidden="true"
      />
      <component :is="door.frame" v-if="door.frame" class="absolute inset-0 block w-full h-full pointer-events-none" />
      <div
        ref="leaf"
        data-leaf
        :data-nudge="nudge && phase === 'invite' ? '' : undefined"
        class="absolute inset-0 origin-[0_50%] backface-hidden select-none [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
        role="img"
        :aria-label="door.label"
      >
        <component :is="door.component" class="block w-full h-full" />
      </div>
      <div ref="strip" class="absolute left-[8%] right-[8%] -bottom-px h-[2px] opacity-0 bg-[#ffd56a] shadow-[0_0_6px_1px_rgb(255_213_106/0.6)] pointer-events-none" aria-hidden="true" />
      <button
        v-if="!closing"
        class="door-hit absolute inset-0 z-3 p-0 m-0 border-0 bg-transparent cursor-pointer select-none [touch-action:manipulation] [-webkit-tap-highlight-color:transparent] outline-none"
        type="button"
        aria-label="Ouvrir la porte"
        :aria-describedby="phase === 'invite' ? 'door-said' : undefined"
        :data-phase="phase"
        :data-kbd="keyboard"
        @click="onDoor"
        @keydown="onDoorKeydown"
        @mousedown="onDoorMousedown"
      />
      <div ref="captionLayer" class="absolute left-1/2 top-[18%] h-0 pointer-events-none" aria-hidden="true">
        <span v-for="n in CAPTIONS" :key="n" class="absolute top-0 left-0 -translate-x-1/2 text-[1.3rem] font-bold tracking-[0.1em] text-accent opacity-0">TOC</span>
      </div>
      <div ref="dustLayer" class="absolute inset-x-0 top-0 h-0 pointer-events-none" aria-hidden="true">
        <span v-for="n in 10" :key="n" class="absolute top-0 left-0 w-[3px] h-[3px] bg-[#c9b79a] opacity-0" />
      </div>
    </div>
    <div v-if="!closing" ref="ui" class="scene scene--ui content-start gap-3 grid-rows-[auto_1.25rem_2.5rem]">
      <!-- Phrase + fantômes invisibles (toutes les phrases possibles de la visite) dans la même cellule : la hauteur réservée est celle de la plus longue, la scène ne bouge pas entre les phases. -->
      <div class="grid grid-cols-[minmax(0,1fr)] justify-items-center w-full">
        <p id="door-said" class="lead max-w-full [text-wrap:balance] [overflow-wrap:anywhere] max-sm:text-[clamp(1.3rem,6vw,1.7rem)] [grid-area:1/1]">{{ said }}</p>
        <span
          v-for="(g, i) in ghosts"
          :key="i"
          class="lead max-w-full [text-wrap:balance] [overflow-wrap:anywhere] max-sm:text-[clamp(1.3rem,6vw,1.7rem)] [grid-area:1/1] invisible pointer-events-none"
          aria-hidden="true"
          >{{ g }}</span
        >
      </div>
      <KnockPattern :class="{ invisible: phase === 'invite' }" :pattern="pattern" :lit="lit" :filled="filled" :mode="phase === 'listen' ? 'listen' : 'repeat'" />
      <p class="m-0 text-[0.9rem]" aria-hidden="true">{{ hint }}</p>
      <p class="sr-only" role="status" aria-live="polite">{{ announce }}</p>
    </div>
    <SparkPool ref="sparks" />
  </section>
</template>

<style scoped>
/* Reste en CSS: .scene (gap > règle globale), ::after décoratif, :has/:deep, paysage. */
.scene {
  gap: 0.75rem;
}
.scene--ui {
  max-width: none;
}
@media (max-height: 30rem) and (orientation: landscape) {
  [data-stage] {
    height: min(var(--stage-cap), calc(100dvh - var(--taskbar-h) - 1.5rem));
  }
}
.door-hit::after {
  content: '';
  position: absolute;
  left: 6%;
  right: 6%;
  bottom: -3px;
  height: 4px;
  background: var(--accent);
  box-shadow: 0 0 0.7778rem 0.2222rem rgb(255 226 140 / 0.8);
  opacity: 0;
  transition: opacity 0.2s;
}
.door-hit:not([data-phase='listen']):is(:hover, [data-kbd='true']:focus-visible)::after {
  opacity: 1;
}
[data-leaf] :deep(svg) {
  transform-origin: 0 50%;
  transition:
    transform 0.25s,
    filter 0.25s;
}
[data-stage]:has(.door-hit:not([data-phase='listen']):is(:hover, [data-kbd='true']:focus-visible)) [data-leaf] :deep(svg) {
  transform: perspective(700px) rotateY(-5deg);
  filter: drop-shadow(0 0 0.5556rem rgb(255 226 140 / 0.55));
}
/* Focus clavier : anneau qui suit la silhouette de la porte (quatre ombres nettes, une par côté), jamais au clic ni au tap (data-kbd). */
[data-stage]:has(.door-hit[data-kbd='true'][data-phase]:focus-visible) [data-leaf] :deep(svg) {
  filter: drop-shadow(3px 0 0 var(--accent)) drop-shadow(-3px 0 0 var(--accent)) drop-shadow(0 3px 0 var(--accent)) drop-shadow(0 -3px 0 var(--accent));
}
/* Contraste forcé (Windows High Contrast) : les ombres et lueurs disparaissent, on dessine un vrai contour. */
@media (forced-colors: active) {
  .door-hit[data-kbd='true']:focus-visible {
    outline: 2px solid Highlight;
    outline-offset: -4px;
  }
}
/* Invite : la porte respire (6 s par cycle, ≈0,17 Hz, 1,5 % d’amplitude), sans changement de luminance. Coupée dès le premier coup. */
[data-leaf][data-nudge] {
  animation: door-breathe 6s ease-in-out infinite;
}
@keyframes door-breathe {
  50% {
    transform: scale(1.015);
  }
}
/* Halo de la boule de cristal : respiration lente (5 s, ≈0,2 Hz), faible amplitude, jamais de scintillement. */
[data-stage] :deep(.seer-halo) {
  animation: seer-halo 5s ease-in-out infinite;
}
@keyframes seer-halo {
  50% {
    opacity: 0.4;
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-leaf][data-nudge] {
    animation: none;
  }
  [data-stage] :deep(.seer-halo) {
    animation: none;
  }
  [data-stage]:has(.door-hit:not([data-phase='listen']):is(:hover, [data-kbd='true']:focus-visible)) [data-leaf] :deep(svg) {
    transform: none;
  }
}
@media (max-height: 30rem) and (orientation: landscape) {
  .scene:not(.scene--ui) {
    height: auto;
    grid-template-rows: none;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    column-gap: 1.5rem;
    max-width: 44rem;
  }
}
</style>
