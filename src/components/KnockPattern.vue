<script setup lang="ts">
import type { Gap } from '../engine/rhythm'

/**
 * Pattern of the seer drawn as dots: ● ● ─── ● (a long gap is a wider, ruled space).
 * listen: dots 0..lit-1 are lit (seer progress). repeat: dots 0..filled-1 are filled (player progress).
 * Decorative only: the announcements live in DoorScene's aria-live region.
 */
defineProps<{ pattern: Gap[]; lit: number; filled: number; mode: 'listen' | 'repeat' }>()
</script>

<template>
  <div class="flex items-center justify-center h-5 select-none" aria-hidden="true" data-knock-pattern>
    <template v-for="n in pattern.length + 1" :key="n">
      <span
        class="block size-4 rounded-full border-2 border-solid border-fg [transition:transform_0.15s,background-color_0.15s] motion-reduce:transition-none"
        :data-dot="n - 1"
        :data-on="(mode === 'listen' ? n <= lit : n <= filled) ? '' : undefined"
        :class="(mode === 'listen' ? n <= lit : n <= filled) ? (mode === 'listen' ? 'bg-accent scale-110 motion-reduce:scale-100' : 'bg-alt scale-110 motion-reduce:scale-100') : 'bg-transparent'"
      />
      <span v-if="n <= pattern.length" class="block" :data-gap="pattern[n - 1]" :class="pattern[n - 1] === 'long' ? 'w-10 h-0 border-t-2 border-solid border-fg mx-1 opacity-70' : 'w-3'" />
    </template>
  </div>
</template>
