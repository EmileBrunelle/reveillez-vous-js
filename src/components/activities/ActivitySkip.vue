<script setup lang="ts">
// Bouton « Passer » commun aux activités : posé en absolu dans un coin (aucun élément fonctionnel ne bouge), il apparaît en fondu seulement.
// Une fois affiché, le bouton reste monté (sinon le focus clavier tombe sur <body> pendant la fin d’activité) : quand `show` repasse à faux, il devient inerte (aria-disabled, clics ignorés) et sort en fondu ; invisible, il sort de l’ordre de tabulation (tabindex -1) et du lecteur d’écran (aria-hidden), sans `inert` pour garder le focus.
import { ref, watch } from 'vue'

const { show } = defineProps<{ show: boolean }>()
const emit = defineEmits<{ skip: [] }>()
const shown = ref(show)
watch(
  () => show,
  (v) => {
    if (v) shown.value = true
  },
)
const onClick = () => {
  if (show) emit('skip')
}
</script>

<template>
  <button
    v-if="shown"
    type="button"
    class="skip win-btn font-ui text-lg absolute bottom-2 right-6 z-10 transition-[opacity,translate] duration-200 ease-in before:content-[''] before:absolute before:-inset-[9px] focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-black focus-visible:outline-offset-[-6px]"
    :aria-disabled="show ? undefined : 'true'"
    :aria-hidden="show ? undefined : 'true'"
    :tabindex="show ? undefined : -1"
    :class="{ 'opacity-0 translate-y-3 cursor-default pointer-events-none': !show }"
    @click="onClick"
  >
    Passer
  </button>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .skip {
    animation: skip-in 1.2s ease-out backwards;
  }
}
@keyframes skip-in {
  from {
    opacity: 0;
    translate: 0 0.75rem;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
</style>
