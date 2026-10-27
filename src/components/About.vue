<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Dialog } from '@vuetify/v0'
import { animate } from 'motion-v'
import { useReducedMotion } from '../composables/useReducedMotion'
import { finishAnimations, type Stoppable } from '../composables/finishAnimations'
import { aboutClose, aboutOpen } from '../audio/sfx'
import { REPO_URL } from '../content/finale'

// Parent v-model = "wants open". `shown` is what the native dialog actually sees, so the close animation
// can play before the dialog really closes. Pure DOM + motion: no dependency on WebGPU.
const open = defineModel<boolean>({ default: false })
const shown = ref(false)
const reduced = useReducedMotion()
const win = ref<HTMLElement>()
const bar = ref<HTMLElement>()
const title = ref<HTMLElement>()
const body = ref<HTMLElement>()

let running: Stoppable[] = []
let busy = false
const run = (el: Element | undefined, kf: Record<string, unknown>, opt: Record<string, unknown>) => {
  if (!el) return Promise.resolve()
  const c = animate(el, kf as never, opt as never)
  running.push(c)
  return Promise.resolve(c).catch(() => undefined)
}
const stopAll = () => {
  running.forEach((r) => r.stop())
  running = []
}
const set = (el: Element | undefined, kf: Record<string, string | number>) => {
  if (el) Object.assign((el as HTMLElement).style, kf)
}
const rest = () => {
  set(win.value, { clipPath: 'none', opacity: '1', transform: 'none' })
  set(bar.value, { opacity: '1' })
  set(title.value, { clipPath: 'none' })
  set(body.value, { opacity: '1' })
}
// The CRT world dims and recedes while the window is up.
const zoomWorld = (on: boolean) => {
  const app = document.querySelector<HTMLElement>('.app')
  if (!app || reduced.value) return
  void run(app, { scale: on ? 0.95 : 1, opacity: on ? 0.45 : 1 }, { duration: on ? 0.4 : 0.2, ease: 'easeOut' })
}

const FULL = 'inset(0% 0% 0% 0%)'
const LINE = 'inset(49.5% 0% 49.5% 0%)'
const DOT = 'inset(49.5% 30% 49.5% 30%)'
const typed = (t: number) => Math.floor(t * 18) / 18

const playOpen = async () => {
  busy = true
  stopAll()
  aboutOpen()
  if (reduced.value) {
    set(win.value, { clipPath: 'none', transform: 'none' })
    await run(win.value, { opacity: [0, 1] }, { duration: 0.15 })
  } else {
    set(bar.value, { opacity: '1' })
    set(body.value, { opacity: '0' })
    zoomWorld(true)
    void run(title.value, { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] }, { duration: 0.28, delay: 0.14, ease: typed })
    void run(body.value, { opacity: [0, 1] }, { duration: 0.2, delay: 0.3, ease: 'easeOut' })
    await run(win.value, { clipPath: [DOT, LINE, FULL], opacity: [0, 1, 1], transform: ['scale(0.9)', 'scale(1)', 'scale(1)'] }, { duration: 0.42, times: [0, 0.4, 1], ease: 'easeOut' })
    await new Promise((r) => setTimeout(r, 90))
  }
  rest()
  busy = false
}

const playClose = async () => {
  busy = true
  stopAll()
  aboutClose()
  if (reduced.value) await run(win.value, { opacity: [1, 0] }, { duration: 0.1 })
  else {
    zoomWorld(false)
    await run(win.value, { clipPath: [FULL, LINE, DOT], opacity: [1, 1, 0] }, { duration: 0.22, times: [0, 0.5, 1], ease: 'easeIn' })
  }
  busy = false
  shown.value = false
  open.value = false
}

watch(
  open,
  async (o) => {
    if (o && !shown.value) {
      shown.value = true
      await nextTick()
      void playOpen()
    } else if (!o && shown.value && !busy) void playClose()
  },
  { immediate: true },
) // composant async : il peut se monter alors que le parent veut déjà l’ouvrir

const request = (v: boolean) => {
  if (!v && shown.value) void closeNow()
}
let closingNow = false
const closeNow = async () => {
  if (closingNow) return
  closingNow = true
  await playClose()
  closingNow = false
}
// Escape: keep the native dialog open until the close animation ends.
const onCancel = (e: Event) => {
  e.preventDefault()
  request(false)
}
// A click during the open animation skips it.
// `stop()` laisse la fenêtre figée à mi-course (ligne bleue, corps à opacité 0) : on mène plutôt les animations à leur fin, puis on pose l’état de repos.
const skip = () => {
  if (busy && !closingNow) {
    finishAnimations(running)
    running = []
    rest()
    busy = false
  }
}
</script>

<template>
  <Dialog.Root :model-value="shown" @update:model-value="request">
    <Dialog.Content
      class="m-auto p-0 w-[35.5556rem] max-w-[calc(100vw-var(--safe-l)-var(--safe-r))] max-h-[calc(100dvh-var(--safe-t)-var(--safe-b))] top-[var(--safe-t)] right-[var(--safe-r)] bottom-[var(--safe-b)] left-[var(--safe-l)] overflow-auto bg-white text-[#0000aa] border-4 border-solid border-[#0000aa] font-ui text-[0.8889rem] leading-normal text-left backdrop:[background:#0000aa] backdrop:animate-[about-bd_0.3s_ease-out] motion-reduce:backdrop:animate-none"
      @cancel="onCancel"
      @click="skip"
    >
      <div ref="win" class="about__win">
        <div ref="bar" class="flex items-center justify-between gap-2 bg-[#0000aa] text-white py-1 px-2 select-none [-webkit-tap-highlight-color:transparent]">
          <Dialog.Title class="m-0 text-[1rem] font-bold"><span ref="title" class="inline-block whitespace-nowrap">À propos</span></Dialog.Title>
          <Dialog.Close
            class="select-none touch-manipulation [-webkit-tap-highlight-color:transparent] [font:inherit] cursor-pointer text-black border-2 border-solid border-black focus-visible:[outline:3px_solid_#aa0000] focus-visible:outline-offset-[2px] bg-[#aaaaaa] py-0 px-[0.6rem]"
            aria-label="Fermer"
            >X</Dialog.Close
          >
        </div>
        <div ref="body" class="p-4 min-h-[21.1111rem] select-text">
          <Dialog.Description as="p" class="[margin:0_0_0.9rem]">
            <strong>Réveillez-vous.js</strong> : un jeu de voyance où l’on ouvre la porte, se concentre et tire une carte de tarot, pendant que la paranoïa monte.
          </Dialog.Description>
          <p class="[margin:0_0_0.9rem]">Par Émile Brunelle, pour le défi Fortune.js de l’AGEEI (UQAM), 2026.</p>
          <p class="[margin:0_0_0.9rem]">
            <a
              class="select-text text-[#0000aa] underline visited:text-[#550055] focus-visible:[outline:3px_solid_#aa0000] focus-visible:outline-offset-[2px]"
              :href="REPO_URL"
              target="_blank"
              rel="noopener noreferrer"
              >Code source</a
            >
          </p>
          <p class="[margin:0_0_0.9rem]">Ce projet a été écrit avec l’aide de l’IA (Claude Code, d’Anthropic) ; la déclaration complète se trouve dans le README du code source.</p>
          <p class="[margin:0_0_0.9rem]">
            Icônes :
            <a
              class="select-text text-[#0000aa] underline visited:text-[#550055] focus-visible:[outline:3px_solid_#aa0000] focus-visible:outline-offset-[2px]"
              href="https://game-icons.net"
              target="_blank"
              rel="noopener noreferrer"
              >game-icons.net</a
            >
            (CC BY 3.0). Polices : VT323, IM Fell English et Cinzel (SIL OFL 1.1).
          </p>
          <Dialog.Close
            class="select-none touch-manipulation [-webkit-tap-highlight-color:transparent] [font:inherit] cursor-pointer text-black border-2 border-solid border-black focus-visible:[outline:3px_solid_#aa0000] focus-visible:outline-offset-[2px] bg-[#ffff55] py-[0.4rem] px-4"
            >Fermer</Dialog.Close
          >
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Root>
</template>
