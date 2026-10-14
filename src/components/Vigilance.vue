<script setup lang="ts">
import { ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'

defineProps<{ level: number }>()
const emit = defineEmits<{ reset: [] }>()
const flash = ref(false)
const { start } = useTimeoutFn(() => (flash.value = false), 1500, { immediate: false })

// Hidden gesture: 3 quick clicks/taps (browser-counted `detail`) wipe the visit counter.
const onClick = (e: MouseEvent) => {
  if (e.detail < 3) return
  emit('reset')
  flash.value = true
  start()
}
</script>

<template>
  <p class="m-0 text-[0.75rem] tracking-[0.05em] select-none [-webkit-tap-highlight-color:transparent]" :class="{ 'vigil--reset': flash }" :title="`Niveau de vigilance : ${level} sur 5 (triple-cliquez pour recommencer à zéro)`" @click="onClick">
    <span v-if="flash" role="status">Vigilance réinitialisée</span>
    <span v-else class="inline-flex items-center gap-1" role="img" :aria-label="`Niveau de vigilance : ${level} sur 5`">
      <svg class="w-4 h-4 flex-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M1 8s2.7-4.5 7-4.5S15 8 15 8s-2.7 4.5-7 4.5S1 8 1 8z" /><circle cx="8" cy="8" r="1.8" fill="currentColor" /></svg>
      <span class="font-bold tabular-nums" aria-hidden="true">{{ level }}</span>
    </span>
  </p>
</template>

<style scoped>
.vigil--reset { animation: vigil-flash 0.4s steps(4); }
@keyframes vigil-flash { 0% { opacity: 0.1; } 100% { opacity: 0.8; } }
@media (prefers-reduced-motion: reduce) { .vigil--reset { animation: none; } }
</style>
