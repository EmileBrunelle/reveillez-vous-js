<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useDocumentVisibility, usePreferredReducedMotion } from '@vueuse/core'

const canvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
let porch: { setPaused(paused: boolean): void; stop(): void } | null = null
let gone = false
const reducedMotion = usePreferredReducedMotion()
const visibility = useDocumentVisibility()
watch(visibility, (v) => porch?.setPaused(v === 'hidden'))
// The paranoia level reaches backgrounds through the --paranoia CSS variable (set by App.vue, 0..1).
const paranoia = () => Number.parseFloat(document.documentElement.style.getPropertyValue('--paranoia')) || 0

onMounted(async () => {
  try {
    const { startPorch } = await import('../../effects/porch')
    await new Promise((r) => requestAnimationFrame(r)) // canvas is laid out
    if (gone) return
    const s = await startPorch(canvas.value!, () => reducedMotion.value !== 'reduce', paranoia, () => (failed.value = true))
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
  <div class="fixed inset-0 z-0 pointer-events-none porch" aria-hidden="true">
    <canvas v-show="!failed" ref="canvas" class="absolute inset-0 w-full h-full select-none" />
  </div>
</template>

<style scoped>
/* Fallback when the pipeline fails: plain dark night gradient. */
.porch { background: radial-gradient(ellipse at 70% 20%, #2a3350 0, transparent 30%), linear-gradient(#070a14, #141c26 70%, #05070b); }
</style>
