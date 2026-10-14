<script setup lang="ts">
import { nextTick, onMounted } from 'vue'

// Substitut provisoire : la finale du niveau 5 sera remplacée par un vrai composant. Termine tout de suite.
const emit = defineEmits<{ done: [] }>()
onMounted(() => void nextTick(() => emit('done')))
</script>

<template>
  <div aria-hidden="true" />
</template>
