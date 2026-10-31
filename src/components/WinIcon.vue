<script setup lang="ts">
import type { ErrorIcon } from '@/engine/prophecy'

// Icône Windows 98 : disque rouge (×), triangle jaune (!), bulle bleue (i) ou point d’interrogation (?). Partagée par la fausse erreur et son bouton de barre des tâches.
// Classes en littéraux complets (scanner UnoCSS).
const { icon, small = false } = defineProps<{ icon: ErrorIcon; small?: boolean }>()
const ICON: Record<ErrorIcon, { glyph: string; cls: string; warn: boolean }> = {
  stop: { glyph: '×', cls: 'rounded-full bg-[#c00] text-white', warn: false },
  warn: { glyph: '!', cls: 'bg-[#ffd800] text-black [clip-path:polygon(50%_0,100%_100%,0_100%)]', warn: true },
  info: { glyph: 'i', cls: 'rounded-full bg-[#0000a8] text-white', warn: false },
  question: { glyph: '?', cls: 'rounded-full bg-[#0000a8] text-white', warn: false },
}
</script>

<template>
  <span
    class="flex-none grid place-items-center font-bold leading-none"
    :class="[ICON[icon].cls, small ? 'w-4 h-4 text-[0.7rem]' : 'w-8 h-8 text-[1.2rem]', ICON[icon].warn ? (small ? 'pt-1' : 'pt-2') : '']"
    aria-hidden="true"
    >{{ ICON[icon].glyph }}</span
  >
</template>
