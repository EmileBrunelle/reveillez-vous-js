import { ref, watch, type Ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import { secureRng } from '../engine/rng'

// Niveaux 4-5 : rare « hoquet CRT » unique (80-150 ms) : une bande de la carte saute de 2 à 6 px avec une séparation RVB de 1 à 3 px.
// N4 : 1 par lecture, N5 : 1 ou 2. Jamais dans les 2 s qui suivent le retournement ; coupé en mouvement réduit.
// Jamais le corps de la prophétie : seuls numéro, emblème, titre, vers et bandeau bougent ; aucun changement de luminance.
type Options = {
  root: Readonly<Ref<HTMLElement | null>>
  level: () => number
  faceUp: Readonly<Ref<boolean>> // armé quand la face devient visible
  reduced: Readonly<Ref<boolean>>
}

export const useCardGlitch = ({ root, level, faceUp, reduced }: Options) => {
  const rng = secureRng()
  let armed = false
  const pending: number[] = [] // délais (ms) des hoquets restants, chacun compté depuis le précédent
  const delay = ref(0)
  const glitch = () => {
    const bands = root.value?.querySelectorAll<HTMLElement>('.tarot__numero, .tarot__emblem, .tarot__title, .tarot__verse, .tarot__banner')
    const content = root.value?.querySelector<HTMLElement>('.tarot__content')
    if (bands?.length && content) {
      const dur = 80 + rng() * 70
      const dx = (2 + rng() * 4) * (rng() < 0.5 ? -1 : 1)
      const split = 1 + rng() * 2
      bands[Math.floor(rng() * bands.length)].animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: dur, easing: 'steps(2, jump-none)' })
      content.animate([{ textShadow: `${split}px 0 rgb(255 0 0 / 0.5), ${-split}px 0 rgb(0 160 160 / 0.5)` }, { textShadow: 'none' }], { duration: dur, easing: 'steps(2, jump-none)' })
    }
    next()
  }
  const { start } = useTimeoutFn(glitch, delay, { immediate: false })
  const next = () => {
    const d = pending.shift()
    if (d === undefined) return
    delay.value = d
    start()
  }
  watch(faceUp, (up) => {
    if (!up || armed || reduced.value || level() < 4) return
    armed = true
    const n = level() >= 5 && rng() < 0.5 ? 2 : 1
    for (let i = 0; i < n; i++) pending.push(2000 + rng() * 6000)
    next()
  })
}
