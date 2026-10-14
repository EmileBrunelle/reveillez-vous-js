<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useDocumentVisibility, useParallax } from '@vueuse/core'
import { useReducedMotion } from '../../composables/useReducedMotion'

const canvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
let porch: { setPaused(paused: boolean): void; stop(): void } | null = null
let gone = false
const reducedMotion = useReducedMotion()
const visibility = useDocumentVisibility()
watch(visibility, (v) => porch?.setPaused(v === 'hidden'))
// The paranoia level reaches backgrounds through the --paranoia CSS variable (set by App.vue, 0..1).
const root = ref<HTMLElement | null>(null)
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
const paranoia = () => Number.parseFloat(document.documentElement.style.getPropertyValue('--paranoia')) || 0

onMounted(async () => {
  try {
    const { startPorch } = await import('../../effects/porch')
    await new Promise((r) => requestAnimationFrame(r)) // canvas is laid out
    if (gone) return
    const s = await startPorch(canvas.value!, () => !reducedMotion.value, paranoia, parallax, () => (failed.value = true))
    if (gone) return s.stop()
    porch = s
    if (visibility.value === 'hidden') s.setPaused(true)
  } catch (e) {
    console.warn('Porch background disabled:', e)
    failed.value = true
  }
})
onUnmounted(() => {
  gone = true
  porch?.stop()
})
</script>

<template>
  <div ref="root" class="fixed inset-0 z-0 pointer-events-none porch" aria-hidden="true">
    <canvas v-show="!failed" ref="canvas" class="absolute inset-0 w-full h-full select-none" />
  </div>
</template>

<style scoped>
/* Fallback when the pipeline fails: plain dark night gradient. */
.porch { background: radial-gradient(ellipse at 70% 20%, #2a3350 0, transparent 30%), linear-gradient(#070a14, #141c26 70%, #05070b); }
</style>
