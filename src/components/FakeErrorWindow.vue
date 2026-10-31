<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import type { ErrorIcon } from '@/engine/prophecy'
import { useWinDrag } from '@/composables/useWinDrag'

// Une fausse fenêtre d’erreur Windows 98 : un composable de glissement par instance (la liste est un v-for).
// Non modale : la racine se déplace par sa barre de titre, n’importe où dans l’écran visible (même sur la carte).
const { id, title, text, icon, buttons, x, y, width, ready } = defineProps<{
  id: number
  title: string
  text: string
  icon: ErrorIcon
  buttons: string[]
  x: number
  y: number
  width: number
  ready: boolean
}>()
defineEmits<{ close: [] }>()
// Icône Windows 98 : disque rouge (×), triangle jaune (!), bulle bleue (i) ou point d’interrogation (?). Classes en littéraux complets (scanner UnoCSS).
const ICON: Record<ErrorIcon, { glyph: string; cls: string }> = {
  stop: { glyph: '×', cls: 'rounded-full bg-[#c00] text-white' },
  warn: { glyph: '!', cls: 'bg-[#ffd800] text-black [clip-path:polygon(50%_0,100%_100%,0_100%)] pt-2' },
  info: { glyph: 'i', cls: 'rounded-full bg-[#0000a8] text-white' },
  question: { glyph: '?', cls: 'rounded-full bg-[#0000a8] text-white' },
}
const bar = useTemplateRef<HTMLElement>('bar')
const { style: dragStyle } = useWinDrag(
  bar,
  computed(() => ready),
  (el) => el.closest<HTMLElement>('.fake-error'),
)
</script>

<template>
  <div
    :data-id="id"
    class="fake-error win-window absolute pointer-events-auto text-[0.9rem] [font-family:inherit]"
    :class="ready ? 'motion-safe:animate-[fake-in_0.25s_ease-out_both]' : 'invisible pointer-events-none'"
    :style="[{ left: `${x}px`, top: `${y}px`, width: `${width}px` }, dragStyle]"
    role="group"
    :aria-label="`Fausse erreur : ${title}`"
  >
    <div ref="bar" class="flex items-center justify-between gap-2 px-[3px] min-h-6 text-white font-bold bg-gradient-to-r from-[#000080] to-[#1084d0] select-none cursor-move touch-none">
      <span class="truncate">{{ title }}</span>
      <button class="win-btn grid place-items-center min-w-6 min-h-6 p-0 leading-none border-0 text-[1rem] cursor-default" type="button" aria-label="Fermer la fausse erreur" @click="$emit('close')">
        ×
      </button>
    </div>
    <div class="flex items-start gap-3 px-3 pt-4 pb-3">
      <span class="flex-none grid place-items-center w-8 h-8 font-bold text-[1.2rem] leading-none" :class="ICON[icon].cls" aria-hidden="true">{{ ICON[icon].glyph }}</span>
      <p class="m-0 text-black">{{ text }}</p>
    </div>
    <div class="flex justify-center gap-2 pb-2">
      <button
        v-for="b in buttons"
        :key="b"
        class="win-btn min-w-[4.5rem] px-2 min-h-[1.75rem] border-0 [font:inherit] focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-[-5px]"
        type="button"
        @click="$emit('close')"
      >
        {{ b }}
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes fake-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
