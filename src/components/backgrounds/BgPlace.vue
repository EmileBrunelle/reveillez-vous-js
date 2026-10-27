<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, useTemplateRef } from 'vue'
import { useDocumentVisibility, useParallax } from '@vueuse/core'
import { useReducedMotion } from '../../composables/useReducedMotion'
import { useProgressStore } from '../../stores/progress'
import { startAmbience } from '../../audio/ambience'
import { startMusic } from '../../audio/music'
import { placeLoaders, type PlaceId } from '../../effects/places'

const props = defineProps<{ place: PlaceId; variant?: Record<string, number>; sharp?: boolean }>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const failed = ref(false)
let scene: { setPaused(paused: boolean): void; stop(): void } | null = null
let gone = false
const reducedMotion = useReducedMotion()
const visibility = useDocumentVisibility()
watch(visibility, (v) => scene?.setPaused(v === 'hidden'))
// The paranoia level (0..1) comes straight from the progress store, read each frame by the shader params.
const root = useTemplateRef<HTMLElement>('root')
const { tilt, roll, source } = useParallax(root)
// Mouse: tilt/roll are already in [-0.5, 0.5] around the centre -> x2 gives [-1, 1].
// Phone: tilt/roll are absolute angles/90 (a phone held at a reading angle is far from 0), so we subtract a slow
// baseline (tau ~4 s, like useTilt) and saturate at ~±15 deg: only gestures count, the scene recentres when still.
const TAU = 4
const RANGE = 15 / 90
let base = { x: 0, y: 0 }
let lastSource = ''
let lastT = 0
const clamp1 = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0)
const parallax = () => {
  const x = tilt.value
  const y = roll.value
  if (source.value === 'mouse') return { x: clamp1(x * 2), y: clamp1(y * 2) }
  const now = performance.now()
  if (lastSource !== 'deviceOrientation' || now - lastT > 1000) base = { x, y } // first reading (or resumed): no jump
  const k = 1 - Math.exp(-Math.min((now - lastT) / 1000, 1) / TAU)
  lastSource = 'deviceOrientation'
  lastT = now
  base = { x: base.x + (x - base.x) * k, y: base.y + (y - base.y) * k }
  return { x: clamp1((x - base.x) / RANGE), y: clamp1((y - base.y) / RANGE) }
}
const progress = useProgressStore()
const paranoia = () => progress.paranoia
let stopAmbience = () => {}
let stopMusic = () => {}
onMounted(async () => {
  stopAmbience = startAmbience(props.place, () => progress.level)
  stopMusic = startMusic(() => progress.level)
  try {
    const [{ createRaymarch }, cfg] = await Promise.all([import('../../effects/raymarch'), placeLoaders[props.place]()])
    await new Promise((r) => requestAnimationFrame(r)) // canvas is laid out
    if (gone) return
    const s = await createRaymarch(canvas.value!, {
      shader: cfg.shader,
      params: (st) => cfg.params({ ...st, variant: props.variant }),
      motion: () => !reducedMotion.value,
      sharp: () => props.sharp ?? false,
      paranoia,
      parallax,
      onLost: () => (failed.value = true),
    })
    if (gone) return s.stop()
    scene = s
    if (visibility.value === 'hidden') s.setPaused(true)
  } catch (e) {
    console.warn('Place background disabled:', e)
    failed.value = true
  }
})
onUnmounted(() => {
  gone = true
  scene?.stop()
  stopAmbience()
  stopMusic()
})
</script>

<template>
  <div ref="root" class="fixed inset-0 z-0 pointer-events-none place" aria-hidden="true">
    <canvas v-show="!failed" ref="canvas" class="absolute inset-0 w-full h-full select-none" />
  </div>
</template>

<style scoped>
/* Fallback when the pipeline fails: plain dark night gradient. */
.place {
  background: radial-gradient(ellipse at 70% 20%, #2a3350 0, transparent 30%), linear-gradient(#070a14, #141c26 70%, #05070b);
}
</style>
