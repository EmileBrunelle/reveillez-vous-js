<script setup lang="ts">
import { muted } from '../audio/sfx'
import Vigilance from './Vigilance.vue'
import IconGithub from '~icons/simple-icons/github'

defineProps<{ canReset?: boolean; level?: number }>()
const emit = defineEmits<{ about: []; reset: []; resetLevel: [] }>()
</script>

<template>
  <footer class="mt-2 mx-0 mb-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.8rem] text-center">
    <Vigilance v-if="level" class="bg-[#000] px-2 py-[0.2rem]" :level="level" @reset="emit('resetLevel')" />
    <span class="opacity-90">Hommage à Terry A. Davis (1969–2018)</span>
    <button class="linklike opacity-90" type="button" @click="emit('about')">À propos</button>
    <a
      class="linklike opacity-90"
      href="https://github.com/EmileBrunelle/reveillez-vous-js"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Code source sur GitHub (nouvel onglet)"
    >
      <IconGithub class="w-[1em] h-[1em] align-[-0.125em] mr-[0.3em]" aria-hidden="true" />
      Code source
    </a>
    <button class="linklike opacity-90" type="button" :aria-pressed="muted" @click="muted = !muted">{{ muted ? 'Son : coupé' : 'Son : actif' }}</button>
    <button v-if="canReset" class="linklike opacity-90" type="button" @click="emit('reset')">Recommencer à zéro</button>
  </footer>
</template>
