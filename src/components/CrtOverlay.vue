<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useDocumentVisibility, usePreferredReducedMotion } from '@vueuse/core'
import { hasWebGpuAdapter } from '../effects/webgpu'

const props = defineProps<{ paranoia: number }>()
const emit = defineEmits<{ ready: []; fail: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
let crt: { setPaused(paused: boolean): void; stop(): void } | null = null
const reducedMotion = usePreferredReducedMotion()
const visibility = useDocumentVisibility()
watch(visibility, (v) => crt?.setPaused(v === 'hidden'))
let gone = false

onMounted(async () => {
  try {
    if (!(await hasWebGpuAdapter())) throw new Error('no adapter')
    const motion = reducedMotion.value !== 'reduce'
    const { startCrt } = await import('../effects/crt')
    await new Promise((r) => requestAnimationFrame(r)) // canvas is laid out
    const s = await startCrt(canvas.value!, motion, () => props.paranoia)
    if (gone) return s.stop()
    crt = s
    if (visibility.value === 'hidden') s.setPaused(true)
    emit('ready')
  } catch {
    if (!gone) emit('fail')
  }
})
onUnmounted(() => {
  gone = true
  crt?.stop()
})
</script>

<template>
  <canvas ref="canvas" class="crt" aria-hidden="true" />
</template>
