import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

// Texte d’une région aria-live présente dès le montage : on la monte vide puis on la remplit juste après,
// sinon les lecteurs d’écran n’annoncent rien (une région insérée avec son contenu n’est pas « modifiée »).
export const useDeferredText = (source: () => string) => {
  const ready = ref(false)
  let timer = 0
  onMounted(() => {
    void nextTick(() => {
      timer = window.setTimeout(() => (ready.value = true), 150)
    })
  })
  onUnmounted(() => window.clearTimeout(timer))
  return computed(() => (ready.value ? source() : ''))
}
