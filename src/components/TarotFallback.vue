<script setup lang="ts">
// Lecture de secours en texte : affichée si le chunk de TarotCard n’a pas pu se charger (le jeu ne reste jamais bloqué).
defineProps<{ title: string; body: string; verse: string }>()
</script>

<template>
  <div class="max-h-full overflow-auto w-full max-w-[70ch] mx-auto p-4 text-left font-card [background:#f3e3b3] [color:#170a2b] [border:0.3rem_solid_#1f1038]">
    <h2 class="font-title m-0 mb-2 text-[1.1rem] uppercase">{{ title }}</h2>
    <p class="m-0 mb-2 text-[1.1rem]">{{ body }}</p>
    <p class="m-0 italic text-right">— {{ verse }}</p>
  </div>
</template>
