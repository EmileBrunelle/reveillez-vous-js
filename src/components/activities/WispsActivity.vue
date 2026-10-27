<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useElementSize, usePreferredReducedMotion, useRafFn, useEventListener, useTimeoutFn } from '@vueuse/core'
import ActivitySkip from './ActivitySkip.vue'
import { useActivityDone } from '../../composables/useActivityDone'
import { secureRng, type Rng } from '../../engine/rng'
import { aimPoint, TOUCH_GRACE_MS } from '../../composables/touchAim'
import { useHaptics } from '../../composables/haptics'
import { isNear, nextWaypoint, stepCatch, stepWisp, wispTuning, type Vec } from '../../engine/wisps'

const props = defineProps<{ level: number }>()
const emit = defineEmits<{ done: [] }>()
const { pulse } = useHaptics()

const { finish, canSkip, isFinished } = useActivityDone(() => emit('done'))
const rng: Rng = secureRng()

const TOTAL = 3
const stage = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(stage)
const tuning = computed(() => wispTuning(props.level, width.value, height.value)) // rayon ≥ 72 px : généreux pour le tactile
const reduced = usePreferredReducedMotion()
const isReduced = computed(() => reduced.value === 'reduce')

const caught = ref(0)
const pos = ref<Vec>({ x: 0, y: 0 })
const trail = shallowRef<Vec[]>([])
const progress = ref(0)
const blooming = ref(false)
const visible = ref(false)
const spawnId = ref(0)
const hidden = ref(false) // mouvement réduit : fondu entre deux sauts
const settled = ref(false)

let vel: Vec = { x: 0, y: 0 }
let target: Vec = { x: 0, y: 0 }
let pointer: Vec | null = null
let untilHop = 0
let placed = false
let waiting = false
let hopWait = 0

const spawn = () => {
  const w = width.value
  const h = height.value
  const start = nextWaypoint(rng, w, h, { x: w / 2, y: h / 2 }, 56, 0)
  pos.value = start
  vel = { x: 0, y: 0 }
  target = nextWaypoint(rng, w, h, start)
  untilHop = 0
  progress.value = 0
  trail.value = []
  blooming.value = false
  visible.value = true
  hidden.value = false
  hopWait = 0
  spawnId.value++
  placed = true
}

const { start: nextWisp } = useTimeoutFn(
  () => {
    waiting = false
    spawn()
  },
  700,
  { immediate: false },
)

const catchIt = () => {
  if (blooming.value || !visible.value || isFinished()) return
  blooming.value = true
  pulse(25)
  trail.value = []
  caught.value++
  if (caught.value >= TOTAL) {
    finish()
  } else {
    waiting = true
    nextWisp()
  }
}

const { pause } = useRafFn(({ delta }) => {
  if (isFinished()) {
    settled.value = true
    pause()
    return
  }
  if (width.value === 0) return
  const dt = Math.min(delta / 1000, 1 / 30)
  if (!placed && !waiting) spawn()
  if (!visible.value || blooming.value) return
  if (isReduced.value) {
    // mouvement réduit : pas de glissade, un saut avec fondu (≥ 300 ms) toutes les 2,4 s
    if (hopWait > 0) {
      hopWait -= dt
      if (hopWait <= 0) {
        pos.value = nextWaypoint(rng, width.value, height.value, pos.value)
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
    progress.value = stepCatch(progress.value, !!pointer && !hidden.value && isNear(pointer, pos.value, tuning.value.radius), dt, tuning.value.hold, tuning.value.decay)
    if (progress.value >= 1) catchIt()
    return
  }
  const next = stepWisp({ pos: pos.value, vel, target, untilHop }, pointer, dt, rng, width.value, height.value, tuning.value)
  vel = next.vel
  target = next.target
  untilHop = next.untilHop
  pos.value = next.pos
  trail.value = [pos.value, ...trail.value].slice(0, 12)
  progress.value = stepCatch(progress.value, !!pointer && isNear(pointer, pos.value, tuning.value.radius), dt, tuning.value.hold, tuning.value.decay)
  if (progress.value >= 1) catchIt()
})

// Au toucher : point de capture 40 px au-dessus du doigt (guide visible), et le doigt levé garde la prise 300 ms.
const guide = ref<Vec | null>(null)
const { start: dropGrace, stop: cancelGrace } = useTimeoutFn(
  () => {
    pointer = null
    guide.value = null
  },
  TOUCH_GRACE_MS,
  { immediate: false },
)
const aim = (e: PointerEvent): Vec => {
  cancelGrace()
  const p = aimPoint(e, stage.value!.getBoundingClientRect())
  guide.value = e.pointerType === 'touch' ? p : null
  return p
}
useEventListener(stage, 'pointermove', (e: PointerEvent) => (pointer = aim(e)))
useEventListener(stage, 'pointerleave', (e: PointerEvent) => {
  if (e.pointerType === 'touch') return // le tactile émet pointerleave juste après pointerup : la tolérance de 300 ms s’applique
  cancelGrace()
  pointer = null
  guide.value = null
})
useEventListener(stage, 'pointercancel', () => {
  cancelGrace()
  pointer = null
  guide.value = null
})
useEventListener(stage, 'pointerup', (e: PointerEvent) => {
  if (e.pointerType === 'touch') dropGrace()
  else if (e.pointerType !== 'mouse') pointer = null
})
useEventListener(stage, 'pointerdown', (e: PointerEvent) => {
  pointer = aim(e)
  if (!hidden.value && isNear(pointer, pos.value, tuning.value.radius)) catchIt()
})

const trailPoints = computed(() => trail.value.filter((_, i) => i % 2 === 1))
</script>

<template>
  <div ref="stage" class="absolute inset-0 touch-none select-none" data-testid="wisps-stage">
    <p class="font-ui absolute inset-x-0 top-3 m-0 px-4 text-center text-xl text-emerald-200/90" aria-live="polite">Suivez les trois feux follets ({{ caught }}/{{ TOTAL }}).</p>
    <p class="sr-only" role="status" aria-live="polite">{{ settled ? 'Les feux follets se sont laissé apprivoiser.' : '' }}</p>
    <span v-if="guide" class="wisp-guide pointer-events-none absolute left-0 top-0 rounded-full" :style="{ transform: `translate3d(${guide.x - 14}px, ${guide.y - 14}px, 0)` }" aria-hidden="true" />
    <template v-if="visible">
      <span
        v-for="(p, i) in trailPoints"
        :key="i"
        class="wisp-trail pointer-events-none absolute left-0 top-0 rounded-full"
        :style="{
          transform: `translate3d(${p.x - 22}px, ${p.y - 22}px, 0) scale(${1 - i * 0.12})`,
          opacity: 0.32 - i * 0.05,
        }"
      />
      <span :key="spawnId" class="wisp-wrap pointer-events-none absolute left-0 top-0" :class="{ 'wisp-hidden': hidden }" :style="{ transform: `translate3d(${pos.x - 22}px, ${pos.y - 22}px, 0)` }">
        <span class="wisp-orb block rounded-full" :class="{ 'wisp-bloom': blooming }" :style="{ '--p': progress }" />
      </span>
    </template>
    <ActivitySkip :show="canSkip" @skip="finish" />
  </div>
</template>

<style scoped>
.wisp-orb,
.wisp-trail {
  width: 44px;
  height: 44px;
  background: radial-gradient(circle, #eafff6 0%, #7dffc8 25%, rgb(60 200 230 / 0.55) 55%, transparent 72%);
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
  transform: scale(calc(1 + var(--p, 0) * 0.35));
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
