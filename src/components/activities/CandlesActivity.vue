<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef } from 'vue'
import { useEventListener, useRafFn, useTimeoutFn } from '@vueuse/core'
import { M as Motion, useMotionValue, useSpring } from 'motion-v'
import ActivitySkip from './ActivitySkip.vue'
import ActivityHud from './ActivityHud.vue'
import { durationOf } from '../../engine/activityTiming'
import { useHaptics } from '../../composables/haptics'
import { TOUCH_GRACE_MS } from '../../composables/touchAim'
import { useActivityDone } from '../../composables/useActivityDone'
import { useDeferredText } from '../../composables/useDeferredText'
import { useReducedMotion } from '../../composables/useReducedMotion'
import { useKeyboardModality } from '../../composables/useKeyboardModality'
import { advanceHold, isNearWick, pickSnuffed } from '../../engine/candles'
import IconChandelle from '~icons/rvj/chandelle'
import { orSecure, type Rng } from '../../engine/rng'

const { level, rng = undefined } = defineProps<{ level: number; rng?: Rng }>()
// Pas de défaut de prop : Vue prendrait la fabrique secureRng comme valeur.
const rand = orSecure(rng)
const emit = defineEmits<{ done: [] }>()
const { pulse } = useHaptics()
const reduced = useReducedMotion()
// Le cadre pulsant de la chandelle soufflée est un repère de focus : réservé au clavier, jamais après un geste du pointeur.
const keyboard = useKeyboardModality()

const COUNT = 3
// État lu par `onFinish` et par les minuteries : déclaré avant `useActivityDone`.
const lit = reactive<boolean[]>(Array(COUNT).fill(false))
const hold = reactive<number[]>(Array(COUNT).fill(0))
const litCount = computed(() => lit.filter(Boolean).length)
// Indice de la chandelle soufflée (-1 : aucune) : courant d’air une seule fois, dès le niveau 3 (l’activité peut être rejouée aux niveaux suivants).
const snuffed = ref(-1)

// Sans rallumage après 4 s, la chandelle se rallume seule (douce chaleur) et l’activité se termine (`finish` n’est lu qu’à l’échéance).
const { start: relightLater, stop: relightStop } = useTimeoutFn(
  () => {
    const i = snuffed.value
    if (i < 0 || isFinished()) return
    lit[i] = true
    hold[i] = 1
    snuffed.value = -1
    finish()
  },
  4000,
  { immediate: false },
)

const { finish, canSkip, isFinished, outcome, startedAt } = useActivityDone(() => emit('done'), {
  durationMs: durationOf('candles'),
  // Fin par n’importe quel chemin (dont les 20 s) : la chandelle soufflée se rallume, rien ne reste sombre.
  // Expiration (échec) : rien ne se rallume, les chandelles restent comme elles sont.
  onFinish: (o) => {
    const i = snuffed.value
    if (o === 'win' && i >= 0) {
      lit[i] = true
      hold[i] = 1
      snuffed.value = -1
    }
    relightStop()
  },
})

// À l’issue la région se vide : le HUD annonce seul le résultat.
const prompt = useDeferredText(() => (outcome.value !== 'play' ? '' : snuffed.value >= 0 ? 'Un courant d’air… Rallumez la chandelle.' : 'Allumez les trois chandelles'))
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

// Chandelles « tenues » : survolées, focalisées ou touchées (pointerdown à pointerup) ; jamais soufflées.
const hovered = reactive<boolean[]>(Array(COUNT).fill(false))
const focused = reactive<boolean[]>(Array(COUNT).fill(false))
const touched = reactive<boolean[]>(Array(COUNT).fill(false))
const protectedSet = () => new Set(Array.from({ length: COUNT }, (_, i) => i).filter((i) => hovered[i] || focused[i] || touched[i]))
const releaseTouch = () => touched.fill(false)
useEventListener(window, 'pointerup', releaseTouch)
useEventListener(window, 'pointercancel', releaseTouch)

// Niveau 3 : une chandelle s’éteint une seule fois, juste après la troisième allumée.
let snuffUsed = level < 3
const { start: snuffLater } = useTimeoutFn(
  () => {
    if (isFinished()) return
    const i = pickSnuffed(lit, rand, protectedSet())
    if (i < 0) {
      // Seule allumée et tenue : on reporte le courant d’air plutôt que d’éteindre sous le curseur.
      if (litCount.value > 0) snuffLater()
      return
    }
    lit[i] = false
    hold[i] = 0
    snuffed.value = i
    relightLater()
  },
  450,
  { immediate: false },
)

const light = (i: number) => {
  if (lit[i] || outcome.value !== 'play') return
  lit[i] = true
  pulse(20)
  hold[i] = 1
  if (snuffed.value === i) {
    snuffed.value = -1
    relightStop()
  }
  if (litCount.value < COUNT) return
  if (!snuffUsed) {
    snuffUsed = true
    snuffLater()
    return
  }
  finish()
}

// Au toucher, l’allumette reste visible 300 ms après le pointerup, puis s’efface en fondu.
const { start: hideMatch, stop: keepMatch } = useTimeoutFn(() => (matchVisible.value = false), TOUCH_GRACE_MS, { immediate: false })
const setTarget = (e: PointerEvent) => {
  keepMatch()
  // Mesure faite au moment de l’événement, sur l’élément qui le reçoit : jamais périmée (transforms, défilement, police).
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  measureWicks(rect)
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  targetX.set(x)
  targetY.set(y)
  // Première apparition (ou mouvement réduit) : pas de glissade depuis l’ancienne position.
  if (!matchVisible.value || reduced.value) {
    matchX.jump(x)
    matchY.jump(y)
  }
  matchVisible.value = true
}
useEventListener(stage, 'pointermove', setTarget)
useEventListener(stage, 'pointerdown', setTarget)
useEventListener(stage, 'pointerup', (e: PointerEvent) => {
  if (e.pointerType === 'touch') hideMatch()
})
useEventListener(stage, 'pointercancel', () => {
  keepMatch()
  matchVisible.value = false
  hold.forEach((_, i) => {
    if (!lit[i]) hold[i] = 0
  })
})
useEventListener(stage, 'pointerleave', (e: PointerEvent) => {
  if (e.pointerType === 'touch') return // pointerleave suit pointerup au toucher : le fondu de 300 ms s’applique
  keepMatch()
  matchVisible.value = false
})

// Mèches (repère de la scène), mesurées à chaque geste du pointeur (trois rectangles, rien dans la boucle d’images) : la place des chandelles
// change avec la fenêtre, la police ou la hauteur du texte d’invite, aucun cache ne reste périmé.
// Le tableau des éléments suit l’ordre du rendu sans que Vue le garantisse : on trie par abscisse (les chandelles sont en rangée, de gauche à droite).
let wicks: { x: number; y: number }[] = []
const measureWicks = (stageRect: DOMRect) => {
  wicks = (candleEls.value ?? [])
    .map((c) => c.getBoundingClientRect())
    .sort((a, b) => a.left - b.left)
    .map((r) => ({ x: r.left - stageRect.left + r.width / 2, y: r.top - stageRect.top + r.height * 0.28 }))
}

const { pause } = useRafFn(({ delta }) => {
  // Activité finie : plus rien à suivre (l’issue dure environ une seconde, la boucle ne tourne plus pour rien).
  if (isFinished()) return pause()
  const dt = Math.min(delta, 50)
  for (let i = 0; i < COUNT; i++) {
    if (lit[i]) continue
    const w = wicks[i]
    const touching = matchVisible.value && !!w && isNearWick(matchX.get(), matchY.get() - 20, w.x, w.y, 44)
    const p = advanceHold(hold[i], touching, dt)
    if (p !== hold[i]) hold[i] = p
    if (p >= 1) light(i)
  }
})
</script>

<template>
  <div ref="stage" class="relative size-full touch-none select-none flex flex-col items-center justify-center gap-6 font-ui text-center">
    <!-- La pièce sombre et sa chaleur couvrent toute la fenêtre (fixed, hors de la colonne de 36 rem) : rien n’est rogné, aucun rectangle visible. -->
    <div class="fixed inset-0 -z-1 pointer-events-none bg-[#07050a]" aria-hidden="true" />
    <div class="warm fixed inset-0 -z-1 pointer-events-none" :class="{ 'no-motion': reduced }" :style="{ opacity: litCount / COUNT }" aria-hidden="true" />
    <p class="relative m-0 text-[1.4rem] text-[#e8d9b0]" :class="{ invisible: outcome !== 'play' }" aria-live="polite">
      {{ prompt }}
    </p>
    <div class="relative flex items-end gap-8 sm:gap-14">
      <button
        v-for="n in COUNT"
        :key="n"
        ref="candleEls"
        type="button"
        class="candle relative bg-transparent border-0 p-0 cursor-pointer w-[4.5rem] h-[11rem] focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-[#e8d9b0] focus-visible:outline-offset-4 focus-visible:shadow-none"
        :class="{ pulse: snuffed === n - 1 && !reduced && keyboard }"
        :aria-label="lit[n - 1] ? `Chandelle ${n} allumée` : `Allumer la chandelle ${n}`"
        @pointerenter="hovered[n - 1] = true"
        @pointerleave="hovered[n - 1] = false"
        @pointerdown="touched[n - 1] = true"
        @focus="focused[n - 1] = true"
        @blur="focused[n - 1] = false"
        @click="light(n - 1)"
      >
        <IconChandelle class="absolute inset-0 size-full" />
        <span class="wick-glow" :style="{ opacity: hold[n - 1] * 0.9 }" aria-hidden="true" />
        <span v-if="snuffed === n - 1 && !reduced" class="smoke" aria-hidden="true" />
        <span class="flame" :class="{ on: lit[n - 1], 'no-motion': reduced }" aria-hidden="true">
          <span class="flame-sway" :class="{ 'no-motion': reduced }" :style="{ animationDelay: `${n * -0.9}s` }" />
        </span>
      </button>
    </div>
    <Motion as="span" class="match absolute left-0 top-0 pointer-events-none" :class="{ shown: matchVisible, 'no-motion': reduced }" :style="{ x: matchX, y: matchY }" aria-hidden="true">
      <span class="match-flame" :class="{ 'no-motion': reduced }" />
      <span class="match-stick" />
    </Motion>
    <ActivityHud activity="candles" :outcome="outcome" :started-at="startedAt" />
    <ActivitySkip :show="canSkip" @skip="finish" />
  </div>
</template>

<style scoped>
.warm {
  background: radial-gradient(ellipse at 50% 65%, rgb(255 140 40 / 0.38), rgb(120 40 10 / 0.18) 55%, transparent 80%);
  transition: opacity 2.4s ease-in-out;
}
.wick-glow {
  position: absolute;
  left: 50%;
  top: 28%;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 50%;
  background: #ff9a2e;
  pointer-events: none;
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
.match {
  opacity: 0;
  transition: opacity 0.2s;
  will-change: transform;
}
.match.shown {
  opacity: 1;
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
.match-stick {
  position: absolute;
  left: -1.5px;
  top: 0;
  width: 3px;
  height: 34px;
  background: #8a5a2b;
  border-radius: 2px;
  transform: rotate(14deg);
  transform-origin: 50% 0;
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
