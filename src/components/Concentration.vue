<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useEntropy } from '../composables/useEntropy'
import { radioStatic } from '../audio/sfx'
import SparkPool from './SparkPool.vue'

const emit = defineEmits<{ done: [] }>()
const { progress, done, start, stop } = useEntropy()

const sparks = ref<InstanceType<typeof SparkPool>>()
const bar = ref<HTMLElement>()
const spark = (e: KeyboardEvent | PointerEvent) => {
  if (e instanceof KeyboardEvent) {
    if (e.repeat) return
    const r = bar.value?.getBoundingClientRect()
    sparks.value?.emit(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top + r.height / 2 : innerHeight / 2)
  } else sparks.value?.emit(e.clientX, e.clientY)
}

onMounted(() => {
  radioStatic(600)
  start()
})
useEventListener(window, ['keydown', 'pointerdown'], spark, { passive: true })
onScopeDispose(stop)
watch(done, (d) => {
  if (d) {
    stop()
    emit('done')
  }
})

// Évite la sélection par clics multiples (double/triple clic) sans toucher au clavier ni au focus.
const onMouseDown = (e: MouseEvent) => {
  if (e.detail > 1) e.preventDefault()
}
</script>

<template>
  <section class="scene" @mousedown="onMouseDown">
    <p class="lead">Concentrez-vous. Tapez, touchez l’écran…</p>
    <SparkPool ref="sparks" />
    <div
      ref="bar"
      class="bar"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(progress * 100)"
    >
      <div class="bar__fill" :style="{ width: progress * 100 + '%' }" />
    </div>
  </section>
</template>
