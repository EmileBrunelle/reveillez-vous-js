<script setup lang="ts">
import { nextTick, onMounted } from 'vue'

// Substitut provisoire : l’activité du niveau sera remplacée par un vrai composant. Termine tout de suite.
defineProps<{ level: number }>()
const emit = defineEmits<{ done: [] }>()
onMounted(() => void nextTick(() => emit('done')))
</script>

<template>
  <div aria-hidden="true" />
</template>
