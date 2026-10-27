<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, useTemplateRef } from 'vue'
import { useDocumentVisibility } from '@vueuse/core'
import { useReducedMotion } from '../composables/useReducedMotion'
import { hasWebGpuAdapter } from '../effects/webgpu'
import { useSessionStore } from '../stores/session'

const { paranoia, off } = defineProps<{ paranoia: number; off?: boolean }>()
const emit = defineEmits<{ ready: []; fail: [] }>()

const session = useSessionStore()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let crt: { setPaused(paused: boolean): void; stop(): void } | null = null
const reducedMotion = useReducedMotion()
const visibility = useDocumentVisibility()
// `off` : la finale a éteint l’écran, le CRT ne rend plus rien (et ne coûte plus de GPU).
watch([visibility, () => off], ([v, isOff]) => crt?.setPaused(v === 'hidden' || !!isOff))
let gone = false
const lost = ref(false)
const TIMEOUT_MS = 5000
const timeout = <T,>(p: Promise<T>, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out`)), TIMEOUT_MS)
    p.then(resolve, reject).finally(() => window.clearTimeout(t))
  })

onMounted(async () => {
  // No WebGPU (or a hung adapter request): the gate. Anything after that is decoration and never blocks.
  let ok = false
  try {
    ok = await timeout(hasWebGpuAdapter(), 'requestAdapter')
  } catch {
    ok = false
  }
  if (gone) return
  if (!ok) return emit('fail')
  const start = (async () => {
    const { startCrt } = await import('../effects/crt')
    await new Promise((r) => requestAnimationFrame(r)) // canvas is laid out
    return startCrt(
      canvas.value!,
      () => !reducedMotion.value,
      () => paranoia,
      () => {
        // Âge (s) depuis le dernier coup, plafonné ; amplitude légèrement modulée par la paranoïa.
        const k = session.knock
        const age = k.seq === 0 ? 10 : Math.min(10, (performance.now() - k.at) / 1000)
        return { age, amp: Math.min(1, k.amp * (0.7 + 0.3 * paranoia)) }
      },
      () => (lost.value = true),
    )
  })()
  try {
    const s = await timeout(start, 'CRT init')
    if (gone) return s.stop()
    crt = s
    if (visibility.value === 'hidden' || off) s.setPaused(true)
  } catch (e) {
    console.warn('CRT overlay disabled:', e)
    lost.value = true
    void start.then(
      (s) => s.stop(),
      () => undefined,
    )
  }
  if (!gone) emit('ready')
})
onUnmounted(() => {
  gone = true
  crt?.stop()
})
</script>

<template>
  <canvas v-show="!lost && !off" ref="canvas" class="fixed inset-0 w-full h-full pointer-events-none z-5 select-none [-webkit-tap-highlight-color:transparent]" aria-hidden="true" />
</template>
