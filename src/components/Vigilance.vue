<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{ level: number }>()
const emit = defineEmits<{ reset: [] }>()
const flash = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
const bar = computed(() => '█'.repeat(props.level) + '░'.repeat(5 - props.level))

// Hidden gesture: 3 quick clicks/taps (browser-counted `detail`) wipe the visit counter.
const onClick = (e: MouseEvent) => {
  if (e.detail < 3) return
  emit('reset')
  flash.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (flash.value = false), 1500)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <p class="m-0 text-[0.8rem] opacity-80 tracking-[0.05em] select-none [-webkit-tap-highlight-color:transparent]" :class="{ 'vigil--reset': flash }" title="Triple-cliquez pour recommencer à zéro" @click="onClick">
    <span v-if="flash" role="status">Vigilance réinitialisée</span>
    <span v-else role="img" :aria-label="`Niveau de vigilance : ${level} sur 5`">Niveau de vigilance : {{ bar }}</span>
  </p>
</template>

<style scoped>
.vigil--reset { animation: vigil-flash 0.4s steps(4); }
@keyframes vigil-flash { 0% { opacity: 0.1; } 100% { opacity: 0.8; } }
@media (prefers-reduced-motion: reduce) { .vigil--reset { animation: none; } }
</style>
