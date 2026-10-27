<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'
import { useGpuEffect } from '../composables/useGpuEffect'
import { useReducedMotion } from '../composables/useReducedMotion'
import { hasWebGpuAdapter } from '../effects/webgpu'
import { useSessionStore } from '../stores/session'

const { paranoia, off } = defineProps<{ paranoia: number; off?: boolean }>()
const emit = defineEmits<{ ready: []; fail: [] }>()

const session = useSessionStore()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const reducedMotion = useReducedMotion()
// Coup de porte : objet réutilisé à chaque image (lu par le CRT, aucune allocation par trame).
const knockRipple = { age: 10, amp: 0 }
// Pas de WebGPU (ou demande d’adaptateur bloquée) : l’écran-barrière. Tout ce qui suit est décoratif et ne bloque jamais.
const { status, lost } = useGpuEffect(
  canvas,
  async (el, onLost) => {
    const { startCrt } = await import('../effects/crt')
    return startCrt(el, {
      motion: () => !reducedMotion.value,
      paranoia: () => paranoia,
      ripple: () => {
        // Âge (s) depuis le dernier coup, plafonné ; amplitude légèrement modulée par la paranoïa.
        const k = session.knock
        knockRipple.age = k.seq === 0 ? 10 : Math.min(10, (performance.now() - k.at) / 1000)
        knockRipple.amp = Math.min(1, k.amp * (0.7 + 0.3 * paranoia))
        return knockRipple
      },
      // `off` : la finale a éteint l’écran, le CRT ne rend plus rien (et ne coûte plus de GPU).
      paused: () => !!off,
      onLost,
    })
  },
  { gate: hasWebGpuAdapter, timeout: 5000, warning: 'Surcouche CRT désactivée :' },
)
watch(status, (s) => (s === 'unavailable' ? emit('fail') : s !== 'starting' && emit('ready')))
</script>

<template>
  <canvas v-show="!lost && !off" ref="canvas" class="fixed inset-0 w-full h-full pointer-events-none z-5 select-none [-webkit-tap-highlight-color:transparent]" aria-hidden="true" />
</template>
