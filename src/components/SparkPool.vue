<script setup lang="ts">
import { ref } from 'vue'
import { animate, useReducedMotion } from 'motion-v'

const SIZE = 24
const reduced = useReducedMotion()
const root = ref<HTMLElement>()
let next = 0
let live: { stop: () => void }[] = []

/** Emits one spark at viewport (x, y); pooled, so at most SIZE exist at any time. */
const emit = (x: number, y: number) => {
  const idx = next++ % SIZE
  const el = root.value?.children[idx] as HTMLElement | undefined
  if (!el) return
  live[idx]?.stop()
  const a = Math.random() * Math.PI * 2
  const d = 18 + Math.random() * 30
  live[idx] = reduced.value
    ? animate(el, { x, y, opacity: [0.8, 0] }, { duration: 0.2 })
    : animate(el, { x: [x, x + Math.cos(a) * d], y: [y, y + Math.sin(a) * d + 8], opacity: [1, 0], scale: [1, 0.2] }, { duration: 0.45, ease: 'easeOut' })
}
defineExpose({ emit })
</script>

<template>
  <div ref="root" class="sparks" aria-hidden="true">
    <span v-for="n in SIZE" :key="n" class="spark" />
  </div>
</template>
