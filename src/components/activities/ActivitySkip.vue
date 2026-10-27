<script setup lang="ts">
// Bouton « Passer » commun aux activités : posé en absolu dans un coin (aucun élément fonctionnel ne bouge), il apparaît en fondu seulement.
defineProps<{ show: boolean }>()
defineEmits<{ skip: [] }>()
</script>

<template>
  <button
    v-if="show"
    type="button"
    class="skip win-btn font-ui text-lg absolute bottom-2 right-2 z-10 focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-black focus-visible:outline-offset-[-6px]"
    @click="$emit('skip')"
  >
    Passer
  </button>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .skip {
    animation: skip-in 1.2s ease-out both;
  }
}
@keyframes skip-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
