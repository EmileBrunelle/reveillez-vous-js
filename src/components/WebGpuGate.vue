<script setup lang="ts">
import IconGithub from '~icons/simple-icons/github'
import { REPO_URL } from '../content/finale'

defineEmits<{ retry: []; about: [] }>()
</script>

<template>
  <main
    class="min-h-screen max-w-[40rem] mx-auto pl-[max(1rem,var(--safe-l))] pr-[max(1rem,var(--safe-r))] pt-[max(2rem,calc(var(--safe-t)+1rem))] pb-[max(2rem,calc(var(--safe-b)+1rem))] grid gap-4 content-center leading-[1.5] bg-[#000] text-fg select-none [-webkit-tap-highlight-color:transparent]"
    role="alert"
  >
    <h1 class="m-0 text-accent uppercase text-[1.6rem]">Les ondes divines exigent WebGPU</h1>
    <p>Sans WebGPU, impossible de capter la transmission. Ce n’est pas négociable : le dépliant ne s’ouvrira pas tant que votre navigateur n’aura pas accès à votre carte graphique.</p>
    <button class="btn justify-self-start" type="button" @click="$emit('retry')">Réessayer</button>
    <footer class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem]">
      <button class="linklike opacity-90" type="button" @click="$emit('about')">À propos</button>
      <a class="linklike opacity-90" :href="REPO_URL" target="_blank" rel="noopener noreferrer" aria-label="Code source sur GitHub (nouvel onglet)">
        <IconGithub class="w-[1em] h-[1em] align-[-0.125em] mr-[0.3em]" aria-hidden="true" />
        Code source
      </a>
    </footer>
  </main>
</template>
