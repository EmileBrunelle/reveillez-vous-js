<script setup lang="ts">
import IconGithub from '~icons/simple-icons/github'

const emit = defineEmits<{ about: [] }>()
</script>

<template>
  <p class="footer">
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
      <IconGithub class="footer__icon" aria-hidden="true" />
      Code source
    </a>
  </p>
</template>

<style scoped>
.footer__icon { width: 1em; height: 1em; vertical-align: -0.125em; margin-right: 0.3em; }
</style>
