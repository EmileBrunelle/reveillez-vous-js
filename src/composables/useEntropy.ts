import { computed, ref } from 'vue'
import { useEventListener } from '@vueuse/core'

const TARGET = 20

/** Ritual only: counts key presses / taps toward a progress bar. Seeds nothing. */
export const useEntropy = (target = TARGET) => {
  const count = ref(0)
  const active = ref(false)

  const record = () => {
    if (active.value) count.value++
  }

  const progress = computed(() => Math.min(1, count.value / target))
  const done = computed(() => progress.value >= 1)

  // Listeners live as long as the calling component; `active` gates counting.
  useEventListener(window, ['keydown', 'pointerdown', 'touchstart'], record, { passive: true })
  const start = () => {
    count.value = 0
    active.value = true
  }
  const stop = () => {
    active.value = false
  }

  return { progress, done, start, stop }
}
