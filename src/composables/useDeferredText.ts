import { computed, onMounted, ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'

// Texte d’une région aria-live présente dès le montage : on la monte vide puis on la remplit juste après,
// sinon les lecteurs d’écran n’annoncent rien (une région insérée avec son contenu n’est pas « modifiée »).
export const useDeferredText = (source: () => string) => {
  const ready = ref(false)
  const { start } = useTimeoutFn(() => (ready.value = true), 150, { immediate: false })
  onMounted(start)
  return computed(() => (ready.value ? source() : ''))
}
