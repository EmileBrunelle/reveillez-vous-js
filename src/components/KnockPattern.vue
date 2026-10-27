<script setup lang="ts">
import type { Gap } from '../engine/rhythm'

/**
 * Motif de la voyante dessiné en points : ● ● ─── ● (une pause longue est un espace plus large, tracé d’un trait).
 * listen : les points 0..lit-1 sont allumés (progression de la voyante). repeat : les points 0..filled-1 sont remplis (progression de la personne).
 * Décoratif seulement : les annonces vivent dans la région aria-live de DoorScene.
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
