<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Dialog } from '@vuetify/v0'
import { animate, useReducedMotion } from 'motion-v'
import { aboutClose, aboutOpen } from '../audio/sfx'

// Parent v-model = "wants open". `shown` is what the native dialog actually sees, so the close animation
// can play before the dialog really closes. Pure DOM + motion: no dependency on WebGPU.
const open = defineModel<boolean>({ default: false })
const shown = ref(false)
const reduced = useReducedMotion()
const win = ref<HTMLElement>()
const bar = ref<HTMLElement>()
const title = ref<HTMLElement>()
const body = ref<HTMLElement>()

let running: { stop: () => void }[] = []
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
  zoomWorld(false)
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

watch(open, async (o) => {
  if (o && !shown.value) {
    shown.value = true
    await nextTick()
    void playOpen()
  } else if (!o && shown.value && !busy) void playClose()
})

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
const skip = () => {
  if (busy && !closingNow) {
    stopAll()
    rest()
    busy = false
  }
}
</script>

<template>
  <Dialog.Root :model-value="shown" @update:model-value="request">
    <Dialog.Content class="about" @cancel="onCancel" @click="skip">
      <div ref="win" class="about__win">
      <div ref="bar" class="about__bar">
        <Dialog.Title class="about__title"><span ref="title" class="about__typed">À propos — TempleOS</span></Dialog.Title>
        <Dialog.Close class="about__close" aria-label="Fermer">X</Dialog.Close>
      </div>
      <div ref="body" class="about__body">
        <Dialog.Description as="p" class="about__p">
          <strong>Hommage à Terry A. Davis (1969–2018)</strong>, qui a écrit seul TempleOS, un système
          d’exploitation 64 bits complet, avec son propre compilateur et son propre langage, HolyC. Il
          l’a conçu comme un temple, en 640×480 et 16 couleurs.
        </Dialog.Description>
        <p class="about__p">
          TempleOS avait un « oracle » qui tirait des mots au hasard. Ce site tire lui aussi ses
          prophéties au hasard.
        </p>
        <ul class="about__links">
          <li><a href="https://en.wikipedia.org/wiki/Terry_A._Davis" target="_blank" rel="noopener noreferrer">Terry A. Davis — Wikipédia</a></li>
          <li><a href="https://archive.org/details/TerryADavis_TempleOS_Archive" target="_blank" rel="noopener noreferrer">Archives de TempleOS</a></li>
        </ul>
        <p class="about__p">Icônes : <a href="https://game-icons.net" target="_blank" rel="noopener noreferrer">game-icons.net</a> (CC BY 3.0)</p>
        <Dialog.Close class="about__btn">Fermer</Dialog.Close>
      </div>
      </div>
    </Dialog.Content>
  </Dialog.Root>
</template>
