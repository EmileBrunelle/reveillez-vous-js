<script setup lang="ts">
import { ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import IconEye from '~icons/rvj/oeil'

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
  <p
    class="m-0 text-[0.75rem] tracking-[0.05em] select-none [-webkit-tap-highlight-color:transparent]"
    :class="{ 'vigil--reset': flash }"
    :title="`Niveau de vigilance : ${level} sur 5 (triple-cliquez pour recommencer à zéro)`"
    @click="onClick"
  >
    <span v-if="flash" role="status">Vigilance réinitialisée</span>
    <span v-else class="inline-flex items-center gap-1" role="img" :aria-label="`Niveau de vigilance : ${level} sur 5`">
      <IconEye class="w-4 h-4 flex-none" />
      <span class="font-bold tabular-nums" aria-hidden="true">{{ level }}</span>
    </span>
  </p>
</template>

<style scoped>
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
  .vigil--reset {
    animation: none;
  }
}
</style>
