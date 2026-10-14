<script setup lang="ts">
import IconGithub from '~icons/simple-icons/github'

const emit = defineEmits<{ about: [] }>()
</script>

<template>
  <p class="mt-2 mx-0 mb-0 text-[0.8rem] opacity-90">
    Hommage à Terry A. Davis (1969–2018) ·
    <button class="linklike" type="button" @click="emit('about')">À propos</button>
    ·
    <a
      class="linklike"
      href="https://github.com/EmileBrunelle/reveillez-vous-js"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Code source sur GitHub (nouvel onglet)"
    >
      <IconGithub class="w-[1em] h-[1em] align-[-0.125em] mr-[0.3em]" aria-hidden="true" />
      Code source
    </a>
  </p>
</template>
