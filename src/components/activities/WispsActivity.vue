<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, useTemplateRef } from 'vue'
import { useElementBounding, useElementSize, useEventListener, useRafFn, useTimeoutFn } from '@vueuse/core'
import { M as Motion, useMotionValue } from 'motion-v'
import { useDeferredText } from '@/composables/useDeferredText'
import { useReducedMotion } from '@/composables/useReducedMotion'
import ActivityHud from './ActivityHud.vue'
import { provideHudRefs } from '@/composables/hudRefs'
import { durationOf } from '@/engine/activityTiming'
import { useActivityDone } from '@/composables/useActivityDone'
import { secureRng, type Rng } from '@/engine/rng'
import { aimPoint, TOUCH_GRACE_MS } from '@/composables/touchAim'
import { useHaptics } from '@/composables/haptics'
import { isNear, nextWaypoint, stepCatch, stepWisp, wispTuning, type Rect, type Vec } from '@/engine/wisps'

const { level } = defineProps<{ level: number }>()
const emit = defineEmits<{ done: [] }>()
const { pulse } = useHaptics()

const { finish, isFinished, outcome, startedAt, paused, elapsed, graceLeft, afterPause } = useActivityDone(() => emit('done'), { durationMs: durationOf('wisps') })
const rng: Rng = secureRng()

const TOTAL = 3
const stage = useTemplateRef<HTMLElement>('stage')
const { width, height } = useElementSize(stage, undefined, { box: 'border-box' })

// Zone interdite : la consigne (pleine largeur, en haut), le bouton Pause (zone de toucher de 44 px comprise) et la barre de temps du HUD.
// Mesurées sur le DOM (le HUD reste la source de vérité de ses dimensions) ; le feu garde 12 px de marge, orbe compris.
const stageBox = useElementBounding(stage)
const promptEl = useTemplateRef<HTMLElement>('promptEl')
const promptBox = useElementBounding(promptEl)
const hudRefs = provideHudRefs() // le HUD y publie son bouton Pause et sa barre de temps
const pauseBox = useElementBounding(hudRefs.pauseEl)
const barBox = useElementBounding(hudRefs.barEl)
onMounted(async () => {
  await nextTick()
  for (const b of [stageBox, promptBox, pauseBox, barBox]) b.update() // mesure immédiate : le premier feu ne naît pas sur le repli
})
const TOUCH_PAD = 6 // la zone de toucher du bouton Pause dépasse son cadre de 6 px
const hudZones = computed<Rect[]>(() => {
  const ox = stageBox.left.value
  const oy = stageBox.top.value
  const zone = (b: { left: { value: number }; top: { value: number }; right: { value: number }; bottom: { value: number } }, pad = 0): Rect | null =>
    b.right.value > b.left.value ? { x0: b.left.value - ox - pad, y0: b.top.value - oy - pad, x1: b.right.value - ox + pad, y1: b.bottom.value - oy + pad } : null
  const zones = [zone(promptBox), zone(pauseBox, TOUCH_PAD), zone(barBox)].filter((z): z is Rect => !!z)
  // Repli avant la première mesure : bandes du haut et du bas, bouton Pause dans le coin.
  return zones.length
    ? zones
    : [
        { x0: 0, y0: 0, x1: width.value, y1: 52 },
        { x0: 0, y0: height.value - 32, x1: width.value, y1: height.value },
      ]
})
const tuning = computed(() => wispTuning(level, width.value, height.value, hudZones.value)) // rayon ≥ 72 px : généreux pour le tactile
const reduced = useReducedMotion()

// État rendu par Vue (rare : à chaque capture ou apparition).
const caught = ref(0)
const blooming = ref(false)
const visible = ref(false)
const spawnId = ref(0)
const hidden = ref(false) // mouvement réduit : fondu entre deux sauts

// État écrit à chaque image : hors de Vue. Position, traînée et progression passent par des valeurs de mouvement et une variable CSS
// (aucun rendu, aucun nouveau tableau par image) ; le feu follet et chaque point de traînée n’ont qu’un seul maître de transform.
const HALF = 22 // demi-taille du feu follet (44 px)
const wispX = useMotionValue(0)
const wispY = useMotionValue(0)
// Un point de traînée sur deux dans l’historique des 12 dernières positions ; échelle et opacité décroissent avec l’âge (fixes).
const HISTORY = 12
const trailDots = Array.from({ length: HISTORY / 2 }, (_, i) => ({ x: useMotionValue(0), y: useMotionValue(0), scale: 1 - i * 0.12, opacity: 0.32 - i * 0.05 }))
let history: Vec[] = []
// Progression de capture (0–1) : lue par l’orbe (taille) via `v-bind()` dans le style, sans rendu du gabarit.
const progressCss = ref('0')
let progress = 0
const setProgress = (p: number) => {
  progress = p
  progressCss.value = p.toFixed(3)
}

let pos: Vec = { x: 0, y: 0 }
let vel: Vec = { x: 0, y: 0 }
let target: Vec = { x: 0, y: 0 }
let pointer: Vec | null = null
let untilHop = 0
let placed = false
let waiting = false
let hopWait = 0

const place = (p: Vec) => {
  pos = p
  wispX.set(p.x - HALF)
  wispY.set(p.y - HALF)
}
const pushTrail = () => {
  history.unshift(pos)
  history.length = HISTORY
  trailDots.forEach((d, i) => {
    const p = history[2 * i + 1]
    d.x.set(p.x - HALF)
    d.y.set(p.y - HALF)
  })
}

const spawn = () => {
  const w = width.value
  const h = height.value
  const start = nextWaypoint(rng, w, h, { x: w / 2, y: h / 2 }, 56, 0, tuning.value.avoid)
  place(start)
  history = Array.from({ length: HISTORY }, () => start)
  pushTrail()
  vel = { x: 0, y: 0 }
  target = nextWaypoint(rng, w, h, start, 56, undefined, tuning.value.avoid)
  untilHop = 0
  setProgress(0)
  blooming.value = false
  visible.value = true
  hidden.value = false
  hopWait = 0
  spawnId.value++
  placed = true
}

const { start: nextWisp } = useTimeoutFn(
  () =>
    afterPause(() => {
      waiting = false
      spawn()
    }),
  700,
  { immediate: false },
)

const catchIt = () => {
  if (blooming.value || !visible.value || isFinished()) return
  blooming.value = true
  pulse(25)
  caught.value++
  if (caught.value >= TOTAL) {
    finish()
  } else {
    waiting = true
    nextWisp()
  }
}

const { pause } = useRafFn(({ delta }) => {
  if (isFinished()) return pause()
  // En pause (onglet caché, fenêtre sans focus) : le feu follet se fige, la boucle reste armée pour la reprise.
  if (paused.value || width.value === 0) return
  const dt = Math.min(delta / 1000, 1 / 30)
  if (!placed && !waiting) spawn()
  if (!visible.value || blooming.value) return
  if (reduced.value) {
    // mouvement réduit : pas de glissade, un saut avec fondu (≥ 300 ms) toutes les 2,4 s
    if (hopWait > 0) {
      hopWait -= dt
      if (hopWait <= 0) {
        place(nextWaypoint(rng, width.value, height.value, pos, 56, undefined, tuning.value.avoid))
        hidden.value = false
        untilHop = 2.4
      }
    } else {
      untilHop -= dt
      if (untilHop <= 0) {
        hidden.value = true
        hopWait = 0.4
      }
    }
    setProgress(stepCatch(progress, !!pointer && !hidden.value && isNear(pointer, pos, tuning.value.radius), dt, tuning.value.hold, tuning.value.decay))
    if (progress >= 1) catchIt()
    return
  }
  const next = stepWisp({ pos, vel, target, untilHop }, pointer, dt, rng, width.value, height.value, tuning.value)
  vel = next.vel
  target = next.target
  untilHop = next.untilHop
  place(next.pos)
  pushTrail()
  setProgress(stepCatch(progress, !!pointer && isNear(pointer, pos, tuning.value.radius), dt, tuning.value.hold, tuning.value.decay))
  if (progress >= 1) catchIt()
})

// Au toucher : point de capture 40 px au-dessus du doigt (guide visible), et le doigt levé garde la prise 300 ms.
const guideOn = ref(false)
const guideX = useMotionValue(0)
const guideY = useMotionValue(0)
const { start: dropGrace, stop: cancelGrace } = useTimeoutFn(
  () => {
    pointer = null
    guideOn.value = false
  },
  TOUCH_GRACE_MS,
  { immediate: false },
)
const aim = (e: PointerEvent): Vec => {
  cancelGrace()
  // Mesure faite au moment de l’événement, sur l’élément qui le reçoit : jamais périmée.
  const p = aimPoint(e, (e.currentTarget as HTMLElement).getBoundingClientRect())
  guideOn.value = e.pointerType === 'touch'
  guideX.set(p.x - 14)
  guideY.set(p.y - 14)
  return p
}
useEventListener(stage, 'pointermove', (e: PointerEvent) => (pointer = aim(e)))
useEventListener(stage, 'pointerleave', (e: PointerEvent) => {
  if (e.pointerType === 'touch') return // le tactile émet pointerleave juste après pointerup : la tolérance de 300 ms s’applique
  cancelGrace()
  pointer = null
  guideOn.value = false
})
useEventListener(stage, 'pointercancel', () => {
  cancelGrace()
  pointer = null
  guideOn.value = false
})
useEventListener(stage, 'pointerup', (e: PointerEvent) => {
  if (e.pointerType === 'touch') dropGrace()
  else if (e.pointerType !== 'mouse') pointer = null
})
useEventListener(stage, 'pointerdown', (e: PointerEvent) => {
  pointer = aim(e)
  if (!hidden.value && isNear(pointer, pos, tuning.value.radius)) catchIt()
})

// À l’issue la région se vide (le HUD annonce seul le résultat : pas de « 3/3 » juste avant lui).
const prompt = useDeferredText(() => (outcome.value === 'play' ? `Touchez ou cliquez sur les trois feux follets (${caught.value}/${TOTAL}).` : ''))
// La consigne clavier vit hors de la région live (relue à chaque capture sinon) : elle décrit le bouton.
const keyboardHelpId = useId()
</script>

<template>
  <div ref="stage" class="absolute inset-0 touch-none select-none" data-testid="wisps-stage">
    <p ref="promptEl" class="font-ui absolute inset-x-0 top-3 m-0 px-[var(--hud-pause-reserve)] text-center text-xl text-emerald-100" :class="{ invisible: outcome !== 'play' }" aria-live="polite">
      {{ prompt }}
    </p>
    <p :id="keyboardHelpId" class="sr-only">Au clavier, activez le bouton « Attraper le feu follet ».</p>
    <!-- Chemin clavier : visible seulement au focus ; Entrée ou Espace attrape le feu follet quand il est là.
         Toujours monté (sinon le focus tombe sur <body> à la 3e capture) : après l’issue il devient inerte (aria-disabled). -->
    <button
      type="button"
      class="font-ui sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:bottom-16 focus-visible:left-1/2 focus-visible:-translate-x-1/2 focus-visible:px-4 focus-visible:py-1 focus-visible:text-xl focus-visible:text-emerald-100 focus-visible:bg-black/70 focus-visible:border-2 focus-visible:border-solid focus-visible:border-emerald-200 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-white"
      :aria-disabled="outcome === 'play' ? undefined : 'true'"
      :aria-describedby="keyboardHelpId"
      @click="!hidden && catchIt()"
    >
      Attraper le feu follet
    </button>
    <Transition
      enter-from-class="opacity-0 scale-50"
      enter-active-class="transition-[opacity,scale] duration-200 ease-out"
      leave-active-class="transition-[opacity,scale] duration-150 ease-in"
      leave-to-class="opacity-0 scale-50"
    >
      <Motion v-if="guideOn" as="span" class="wisp-guide pointer-events-none absolute left-0 top-0 rounded-full" :style="{ x: guideX, y: guideY }" aria-hidden="true" />
    </Transition>
    <template v-if="visible">
      <!-- Le fondu porte sur le conteneur : l’opacité de chaque point est déjà pilotée par son style. -->
      <Transition enter-from-class="opacity-0" enter-active-class="transition-opacity duration-200 ease-out" leave-active-class="transition-opacity duration-150 ease-in" leave-to-class="opacity-0">
        <span v-if="!blooming && !reduced" class="pointer-events-none absolute inset-0" aria-hidden="true">
          <Motion
            v-for="(d, i) in trailDots"
            :key="i"
            as="span"
            class="wisp-trail pointer-events-none absolute left-0 top-0 rounded-full"
            :style="{ x: d.x, y: d.y, scale: d.scale, opacity: d.opacity }"
          />
        </span>
      </Transition>
      <Motion :key="spawnId" as="span" class="wisp-wrap pointer-events-none absolute left-0 top-0" :class="{ 'wisp-hidden': hidden }" :style="{ x: wispX, y: wispY }">
        <span class="wisp-orb block rounded-full" :class="{ 'wisp-bloom': blooming }" />
      </Motion>
    </template>
    <ActivityHud activity="wisps" :outcome="outcome" :started-at="startedAt" :paused="paused" :elapsed="elapsed" :grace-left="graceLeft" />
  </div>
</template>

<style scoped>
.wisp-orb,
.wisp-trail {
  width: 44px;
  height: 44px;
  background: radial-gradient(circle, #eafff6 0%, #7dffc8 25%, rgb(60 200 230 / 0.55) 55%, transparent 72%);
  filter: blur(1.5px);
}
/* La lueur n’est dessinée que pour l’orbe : douze traînées avec drop-shadow coûtaient cher à chaque image. */
.wisp-orb {
  filter: blur(1.5px) drop-shadow(0 0 14px rgb(90 255 200 / 0.8));
}
.wisp-guide {
  width: 28px;
  height: 28px;
  border: 2px solid rgb(125 255 200 / 0.7);
  box-shadow: 0 0 10px rgb(90 255 200 / 0.5);
}
.wisp-wrap {
  animation: wisp-in 0.6s ease-out;
  transition: opacity 0.4s ease-in-out;
}
.wisp-wrap.wisp-hidden {
  opacity: 0;
}
@keyframes wisp-in {
  from {
    opacity: 0;
  }
}
.wisp-orb {
  transform: scale(calc(1 + v-bind(progressCss) * 0.35));
  transition:
    transform 0.55s cubic-bezier(0.2, 1.6, 0.4, 1),
    opacity 0.55s ease-out;
}
.wisp-orb.wisp-bloom {
  transform: scale(5);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .wisp-orb.wisp-bloom {
    transform: none;
  }
}
</style>
