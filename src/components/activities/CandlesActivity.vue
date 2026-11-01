<script setup lang="ts">
import { reactive, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useEventListener, useRafFn, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import { M as Motion, useMotionValue, useSpring } from 'motion-v'
import ActivityHud from './ActivityHud.vue'
import { durationOf } from '@/engine/activityTiming'
import { useHaptics } from '@/composables/haptics'
import { TOUCH_GRACE_MS } from '@/composables/touchAim'
import { useActivityDone } from '@/composables/useActivityDone'
import { useDeferredText } from '@/composables/useDeferredText'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useKeyboardModality } from '@/composables/useKeyboardModality'
import { COUNT, DRAFT_DELAY_MS, RELIGHT_MS, advanceHolds, autoRelights, initCandles, isNearWick, lightCandle, litCount, relightSnuffed, resetHolds, snuffStep } from '@/engine/candles'
import IconChandelle from '~icons/rvj/chandelle'
import { orSecure, type Rng } from '@/engine/rng'

const { level, rng = undefined } = defineProps<{ level: number; rng?: Rng }>()
// Pas de défaut de prop : Vue prendrait la fabrique secureRng comme valeur.
const rand = orSecure(rng)
const emit = defineEmits<{ done: [] }>()
const { pulse } = useHaptics()
const reduced = useReducedMotion()
// Le cadre pulsant de la chandelle soufflée est un repère de focus : réservé au clavier, jamais après un geste du pointeur.
const keyboard = useKeyboardModality()

// État de jeu (allumées, progression des mèches, chandelle soufflée) : immuable, les règles sont dans `engine/candles.ts`.
const candles = shallowRef(initCandles(level))
// Temps de jeu restant (ms) : les règles du courant d’air en dépendent.
const leftMs = () => Math.max(0, durationOf('candles') - elapsed())

const { finish, isFinished, outcome, startedAt, paused, halted, elapsed, graceLeft } = useActivityDone(() => emit('done'), {
  durationMs: durationOf('candles'),
  // Fin par n’importe quel chemin (victoire ou temps écoulé) : plus aucune minuterie de jeu ne doit agir. Rien ne se rallume
  // à la fin ; une victoire n’arrive jamais pendant qu’une chandelle est soufflée (les trois sont alors allumées).
  onFinish: () => {
    relight.stop()
    snuff.stop()
  },
})

// Minuterie de jeu suspendue pendant la pause subie (onglet caché, fenêtre quittée, menu ouvert) : le temps restant est conservé
// et reprend à la reprise (jamais d’échéance derrière le voile « EN PAUSE »).
interface Suspendable {
  start: (delayMs: number) => void
  stop: () => void
}
const suspendable = (fn: () => void): Suspendable => {
  let armed = false
  let left = 0
  let since = 0
  const timer = useTimeoutFn(
    () => {
      armed = false
      fn()
    },
    () => left,
    { immediate: false },
  )
  const run = () => {
    since = Date.now()
    timer.start()
  }
  watch(
    halted,
    (h) => {
      if (!armed) return
      if (h) {
        left = Math.max(0, left - (Date.now() - since))
        timer.stop()
      } else run()
    },
    { flush: 'sync' },
  )
  return {
    start: (delayMs) => {
      armed = true
      left = delayMs
      timer.stop()
      if (!halted.value) run()
    },
    stop: () => {
      armed = false
      timer.stop()
    },
  }
}

// Niveau 3 : sans rallumage à la main après 4 s, la chandelle soufflée se rallume seule (douce chaleur) et l’activité se termine.
// Dès le niveau 4, aucune minuterie de rallumage : il faut tenir l’allumette sur la mèche.
const relight: Suspendable = suspendable(() => {
  if (isFinished()) return
  const { state, step } = relightSnuffed(candles.value)
  candles.value = state
  if (step === 'win') finish()
})

// Chandelles « tenues » : survolées, focalisées ou touchées (pointerdown à pointerup, par pointeur) ; jamais soufflées.
const hovered = reactive<boolean[]>(Array(COUNT).fill(false))
const focused = reactive<boolean[]>(Array(COUNT).fill(false))
// Identifiant du pointeur qui tient la chandelle (null : aucun) : le relâchement d’un doigt ne libère pas la chandelle d’un autre.
const touchedBy = reactive<(number | null)[]>(Array(COUNT).fill(null))
const protectedSet = () => new Set(Array.from({ length: COUNT }, (_, i) => i).filter((i) => hovered[i] || focused[i] || touchedBy[i] !== null))
const releaseTouch = (e: PointerEvent) => {
  touchedBy.forEach((id, i) => {
    if (id === e.pointerId) touchedBy[i] = null
  })
}
useEventListener(window, 'pointerup', releaseTouch)
useEventListener(window, 'pointercancel', releaseTouch)

// Le courant d’air souffle une seule fois, juste après la troisième chandelle allumée (jamais s’il reste moins de ~4,5 s : les trois
// allumées valent alors la victoire). Si toutes les allumées sont protégées, on réessaie à l’échéance suivante, tant qu’il reste du temps.
const snuff: Suspendable = suspendable(() => {
  if (isFinished()) return
  const { state, step } = snuffStep(candles.value, rand, protectedSet(), leftMs())
  candles.value = state
  if (step === 'win') return finish()
  if (step === 'retry') return snuff.start(DRAFT_DELAY_MS)
  if (autoRelights(level)) relight.start(RELIGHT_MS)
})

const light = (i: number) => {
  if (outcome.value !== 'play') return
  const wasSnuffed = candles.value.snuffed === i
  const { state, step } = lightCandle(candles.value, i, level, leftMs())
  if (step === 'none') return
  candles.value = state
  pulse(20)
  if (wasSnuffed) relight.stop()
  if (step === 'draft') snuff.start(DRAFT_DELAY_MS)
  else if (step === 'win') finish()
}
// Un clic de souris ou un tap (`detail` > 0) n’allume pas : seule l’allumette tenue sur la mèche le fait.
// Entrée ou Espace sur une chandelle focalisée (`detail` = 0) allume tout de suite, pour l’accessibilité.
const onClick = (e: MouseEvent, i: number) => {
  if (e.detail > 0) return
  light(i)
}

// Consigne : la région aria-live garde sa hauteur (2 lignes) et se cache à l’issue au lieu de se vider, sinon la rangée sauterait ;
// le HUD annonce seul le résultat.
const PROMPT = 'Tenez l’allumette sur chaque mèche'
const PROMPT_DRAFT = 'Un courant d’air… Rallumez la chandelle.'
const prompt = useDeferredText(() => (candles.value.snuffed >= 0 ? PROMPT_DRAFT : PROMPT))
const stage = useTemplateRef<HTMLElement>('stage')
const candleEls = useTemplateRef<HTMLElement[]>('candleEls')

// Allumette : la cible suit le pointeur, la position la rejoint au ressort (Motion : ζ ≈ 0,7, ~5 % de dépassement, du poids sans rebond).
// Les valeurs de mouvement alimentent le style sans rendu Vue à chaque image.
const targetX = useMotionValue(0)
const targetY = useMotionValue(0)
const SPRING = { stiffness: 720, damping: 37.5 }
const matchX = useSpring(targetX, SPRING)
const matchY = useSpring(targetY, SPRING)
const matchVisible = ref(false)

// Mesures de la scène et des mèches (repère de la scène) : prises à l’entrée et au pointerdown, refaites si la scène ou une chandelle change de taille
// (fenêtre, police, hauteur de la consigne). Aucune mesure dans le mouvement du pointeur une fois la scène mesurée.
// Le tableau des éléments suit l’ordre du rendu sans que Vue le garantisse : on trie par abscisse (les chandelles sont en rangée, de gauche à droite).
let origin = { left: 0, top: 0 }
let wicks: { x: number; y: number }[] = []
let measured = false
const measure = () => {
  const el = stage.value
  if (!el) return
  const r = el.getBoundingClientRect()
  origin = { left: r.left, top: r.top }
  wicks = (candleEls.value ?? [])
    .map((c) => c.getBoundingClientRect())
    .sort((a, b) => a.left - b.left)
    .map((c) => ({ x: c.left - r.left + c.width / 2, y: c.top - r.top + c.height * 0.28 }))
  measured = true
}
useResizeObserver(
  () => [stage.value, ...(candleEls.value ?? [])],
  () => (measured = false),
)

// Au toucher, l’allumette reste visible 300 ms après le pointerup, puis s’efface en fondu.
const { start: hideMatch, stop: keepMatch } = useTimeoutFn(() => (matchVisible.value = false), TOUCH_GRACE_MS, { immediate: false })
const setTarget = (e: PointerEvent) => {
  // Multitouche : seul le pointeur principal conduit l’allumette.
  if (!e.isPrimary) return
  keepMatch()
  if (!measured) measure()
  const x = e.clientX - origin.left
  const y = e.clientY - origin.top
  targetX.set(x)
  targetY.set(y)
  // Première apparition (ou mouvement réduit) : pas de glissade depuis l’ancienne position.
  if (!matchVisible.value || reduced.value) {
    matchX.jump(x)
    matchY.jump(y)
  }
  matchVisible.value = true
}
useEventListener(stage, 'pointerenter', measure)
useEventListener(stage, 'pointermove', setTarget)
useEventListener(stage, 'pointerdown', (e: PointerEvent) => {
  if (e.isPrimary) measure()
  setTarget(e)
})
useEventListener(stage, 'pointerup', (e: PointerEvent) => {
  if (e.isPrimary && e.pointerType === 'touch') hideMatch()
})
useEventListener(stage, 'pointercancel', (e: PointerEvent) => {
  if (!e.isPrimary) return
  keepMatch()
  matchVisible.value = false
  candles.value = resetHolds(candles.value)
})
useEventListener(stage, 'pointerleave', (e: PointerEvent) => {
  if (!e.isPrimary || e.pointerType === 'touch') return // pointerleave suit pointerup au toucher : le fondu de 300 ms s’applique
  keepMatch()
  matchVisible.value = false
})

// Boucle d’images : seulement tant que l’allumette est visible ou qu’une progression retombe (sinon elle dort).
const { pause: pauseLoop, resume: resumeLoop } = useRafFn(
  ({ delta }) => {
    // Activité finie : plus rien à suivre (l’issue dure environ une seconde, la boucle ne tourne plus pour rien).
    if (isFinished()) return pauseLoop()
    // En pause (onglet caché, fenêtre sans focus) : l’allumette et les mèches se figent, la boucle reste armée pour la reprise.
    if (paused.value) return
    if (!matchVisible.value && candles.value.hold.every((h) => h === 0)) return pauseLoop()
    const dt = Math.min(delta, 50)
    const flameX = matchX.get()
    const flameY = matchY.get() - 20
    const touching = Array.from({ length: COUNT }, (_, i) => matchVisible.value && !!wicks[i] && isNearWick(flameX, flameY, wicks[i].x, wicks[i].y, 44))
    const { state, reached } = advanceHolds(candles.value, touching, dt)
    candles.value = state
    for (const i of reached) light(i)
  },
  { immediate: false },
)
watch(matchVisible, (v) => v && !isFinished() && resumeLoop(), { flush: 'sync' })

// Lueur de la mèche : pleine sur une chandelle allumée, elle suit la progression sur une mèche éteinte.
const glow = (i: number) => (candles.value.lit[i] ? 0.9 : candles.value.hold[i] * 0.9)
</script>

<template>
  <div ref="stage" class="relative size-full touch-none select-none flex flex-col items-center justify-center gap-6 font-ui text-center">
    <!-- La pièce sombre et sa chaleur couvrent toute la fenêtre (fixed, hors de la colonne de 36 rem) : rien n’est rogné, aucun rectangle visible. -->
    <div class="fixed inset-0 -z-1 pointer-events-none bg-[#07050a]" aria-hidden="true" />
    <div class="warm fixed inset-0 -z-1 pointer-events-none" :class="{ 'no-motion': reduced }" :style="{ opacity: litCount(candles) / COUNT }" aria-hidden="true" />
    <!-- Hauteur réservée (2 lignes, le texte le plus long au téléphone) et bas aligné sur les chandelles : la rangée ne bouge ni au montage, ni à l’issue. -->
    <p class="relative m-0 w-full min-h-[2lh] flex items-end justify-center text-[1.4rem] leading-[1.2] text-[#e8d9b0]" :class="{ invisible: outcome !== 'play' }" aria-live="polite">
      {{ prompt }}
    </p>
    <div class="relative flex items-end gap-8 sm:gap-14">
      <button
        v-for="n in COUNT"
        :key="n"
        ref="candleEls"
        type="button"
        class="candle relative bg-transparent border-0 p-0 w-[4.5rem] h-[11rem] focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-[#e8d9b0] focus-visible:outline-offset-4 focus-visible:shadow-none transition-[transform,filter] duration-200 ease-out"
        :class="{
          pulse: candles.snuffed === n - 1 && !reduced && keyboard,
          'no-motion': reduced,
          'cursor-pointer @hover:-translate-y-0.75 @hover:brightness-125 active:translate-y-0.25 active:scale-97 active:brightness-140': !candles.lit[n - 1] && outcome === 'play',
          'cursor-default': candles.lit[n - 1] || outcome !== 'play',
        }"
        :aria-label="candles.lit[n - 1] ? `Chandelle ${n} allumée` : `Allumer la chandelle ${n}`"
        @pointerenter="hovered[n - 1] = true"
        @pointerleave="hovered[n - 1] = false"
        @pointerdown="touchedBy[n - 1] = $event.pointerId"
        @focus="focused[n - 1] = true"
        @blur="focused[n - 1] = false"
        @click="onClick($event, n - 1)"
      >
        <IconChandelle class="absolute inset-0 size-full" />
        <!-- Le fondu porte sur le conteneur : `wick-cue` anime déjà sa propre opacité. -->
        <Transition leave-active-class="transition-opacity duration-200 ease-in" leave-to-class="opacity-0">
          <span v-if="!candles.lit[n - 1] && outcome === 'play'" class="pointer-events-none absolute inset-0" aria-hidden="true">
            <span class="wick-cue" :class="{ 'no-motion': reduced }" :style="{ animationDelay: `${n * -0.7}s` }" />
          </span>
        </Transition>
        <span class="wick-glow absolute left-1/2 top-[28%] size-[7px] -mt-[3.5px] -ml-[3.5px] rounded-[50%] bg-[#ff9a2e] pointer-events-none" :style="{ opacity: glow(n - 1) }" aria-hidden="true" />
        <Transition leave-active-class="transition-[opacity,translate] duration-250 ease-in" leave-to-class="opacity-0 -translate-y-3">
          <span v-if="candles.snuffed === n - 1 && !reduced" class="pointer-events-none absolute inset-0" aria-hidden="true"><span class="smoke" /></span>
        </Transition>
        <span class="flame" :class="{ on: candles.lit[n - 1], 'no-motion': reduced }" aria-hidden="true">
          <span class="flame-sway" :class="{ 'no-motion': reduced }" :style="{ animationDelay: `${n * -0.9}s` }" />
        </span>
      </button>
    </div>
    <Motion
      as="span"
      class="match absolute left-0 top-0 pointer-events-none transition-opacity duration-200 ease-[ease] will-change-transform"
      :class="[matchVisible ? 'opacity-100' : 'opacity-0', { 'no-motion': reduced }]"
      :style="{ x: matchX, y: matchY }"
      aria-hidden="true"
    >
      <span class="match-flame" :class="{ 'no-motion': reduced }" />
      <span class="match-stick absolute -left-[1.5px] top-0 w-[3px] h-[34px] rounded-xs bg-[#8a5a2b] rotate-14 origin-[50%_0]" />
    </Motion>
    <ActivityHud activity="candles" :outcome="outcome" :started-at="startedAt" :paused="paused" :elapsed="elapsed" :grace-left="graceLeft" />
  </div>
</template>

<style scoped>
.warm {
  background: radial-gradient(ellipse at 50% 65%, rgb(255 140 40 / 0.38), rgb(120 40 10 / 0.18) 55%, transparent 80%);
  transition: opacity 2.4s ease-in-out;
}
/* Appel discret sur la mèche éteinte : halo qui respire (3 s, < 0,5 Hz), sur l’opacité seulement ; statique si mouvement réduit. */
.wick-cue {
  position: absolute;
  left: 50%;
  top: 28%;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(232 217 176 / 0.55), rgb(232 217 176 / 0) 70%);
  pointer-events: none;
  opacity: 0.4;
  animation: wick-breathe 3s ease-in-out infinite;
}
@keyframes wick-breathe {
  50% {
    opacity: 0.9;
  }
}
.flame {
  position: absolute;
  left: 50%;
  top: 28%;
  width: 0;
  height: 0;
  transform: translate(-50%, 0) scale(0);
  transform-origin: 50% 0;
  transition: transform 0.45s cubic-bezier(0.34, 1.2, 0.5, 1);
}
.flame.on {
  transform: translate(-50%, 0) scale(1);
}
.flame-sway {
  position: absolute;
  left: -9px;
  bottom: 0;
  width: 18px;
  height: 36px;
  border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
  background: radial-gradient(ellipse at 50% 75%, #fff3c0 0 25%, #ffb52e 55%, #ff6a1a 100%);
  box-shadow: 0 0 22px 8px rgb(255 160 50 / 0.55);
  transform-origin: 50% 100%;
  animation: sway 3.2s ease-in-out infinite;
}
.smoke {
  position: absolute;
  left: calc(50% - 7px);
  top: 28%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(190 190 200 / 0.55), rgb(120 120 130 / 0) 70%);
  pointer-events: none;
  animation: smoke 1.2s ease-out forwards;
}
.candle.pulse:focus-visible {
  outline: 3px solid #e8d9b0;
  animation: none;
}
.candle.pulse {
  outline: 2px solid rgb(232 217 176 / 0.15);
  outline-offset: 4px;
  animation: pulse 1.8s ease-in-out infinite;
}
@keyframes smoke {
  from {
    transform: translate(0, 0) scale(0.6);
    opacity: 0.9;
  }
  to {
    transform: translate(6px, -64px) scale(2.6);
    opacity: 0;
  }
}
@keyframes pulse {
  50% {
    outline-color: rgb(232 217 176 / 0.45);
  }
}
.match-flame {
  position: absolute;
  left: -6px;
  top: -20px;
  width: 12px;
  height: 22px;
  border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
  background: radial-gradient(ellipse at 50% 75%, #fff3c0 0 25%, #ffb52e 60%, #ff6a1a 100%);
  box-shadow: 0 0 12px 4px rgb(255 160 50 / 0.5);
  transform-origin: 50% 100%;
  animation: sway 2.4s ease-in-out infinite;
}
@keyframes sway {
  0%,
  100% {
    transform: rotate(-3deg) scaleY(1);
  }
  50% {
    transform: rotate(3deg) scaleY(1.06);
  }
}
.no-motion {
  animation: none;
  transition-duration: 0s;
}
</style>
