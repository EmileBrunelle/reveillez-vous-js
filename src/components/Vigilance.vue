<script setup lang="ts">
import { ref, useId } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import IconEye from '~icons/rvj/oeil'

defineProps<{ level: number }>()
const emit = defineEmits<{ reset: [] }>()
const hintId = useId()
const flash = ref(false)
const { start } = useTimeoutFn(() => (flash.value = false), 1500, { immediate: false })

// Hidden gesture, même flux dans tous les cas : triple-clic/triple-tap (`detail` compté par le navigateur),
// appui long (600 ms) au doigt ou à la souris, ou Entrée maintenue 600 ms au clavier.
const HOLD_MS = 600
const reset = () => {
  emit('reset')
  flash.value = true
  start()
}
const onClick = (e: MouseEvent) => {
  if (e.detail >= 3) reset()
}

const holding = ref(false)
const { start: startHold, stop: stopHold } = useTimeoutFn(
  () => {
    holding.value = false
    reset()
  },
  HOLD_MS,
  { immediate: false },
)
const press = () => {
  if (holding.value) return
  holding.value = true
  startHold()
}
const release = () => {
  holding.value = false
  stopHold()
}
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.repeat) press()
}
const onKeyup = (e: KeyboardEvent) => {
  if (e.key === 'Enter') release()
}
</script>

<template>
  <button
    type="button"
    class="relative m-0 p-0 border-0 bg-transparent [color:inherit] [font-family:inherit] leading-[inherit] text-[0.75rem] tracking-[0.05em] cursor-pointer select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] before:content-[''] before:absolute before:-inset-[2px]"
    :class="{ 'vigil--reset': flash }"
    :aria-describedby="hintId"
    :title="`Niveau de vigilance : ${level} sur 5 (triple-clic, appui long ou Entrée maintenue pour recommencer à zéro)`"
    @click="onClick"
    @contextmenu.prevent
    @pointerdown="press"
    @pointerup="release"
    @pointerleave="release"
    @pointercancel="release"
    @keydown="onKeydown"
    @keyup="onKeyup"
    @blur="release"
  >
    <span :id="hintId" class="sr-only" aria-hidden="true">Triple-clic, appui long ou Entrée maintenue 600 millisecondes pour recommencer à zéro.</span>
    <span v-if="flash" role="status">Vigilance réinitialisée</span>
    <span v-else class="inline-flex items-center gap-1" role="img" :aria-label="`Niveau de vigilance : ${level} sur 5`">
      <IconEye class="w-4 h-4 flex-none" />
      <span class="font-bold tabular-nums" aria-hidden="true">{{ level }}</span>
    </span>
    <svg v-if="holding" class="vigil-ring absolute inset-0 m-auto w-7 h-7 pointer-events-none -rotate-90" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" stroke-width="2" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" />
    </svg>
  </button>
</template>

<style scoped>
.vigil-ring circle {
  animation: vigil-fill 0.6s linear forwards;
}
@keyframes vigil-fill {
  to {
    stroke-dashoffset: 0;
  }
}
.vigil--reset {
  animation: vigil-flash 0.4s steps(4);
}
@keyframes vigil-flash {
  0% {
    opacity: 0.1;
  }
  100% {
    opacity: 0.8;
  }
}
@media (prefers-reduced-motion: reduce) {
  .vigil--reset,
  .vigil-ring circle {
    animation: none;
  }
  .vigil-ring circle {
    stroke-dashoffset: 50;
  }
}
</style>
