<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { onClickOutside, useEventListener, useIntervalFn, useTimeoutFn } from '@vueuse/core'
import { useSessionStore } from '../stores/session'
import { muted } from '../audio/sfx'
import { loadAbout, loadCollection, loadReset, loadSound, prefetch } from '../lazy'
import Vigilance from './Vigilance.vue'
import IconStart from '~icons/rvj/demarrer'
import IconSound from '~icons/rvj/son'
import IconSoundOff from '~icons/rvj/son-coupe'
import IconFullscreen from '~icons/rvj/fullscreen'
import IconFullscreenExit from '~icons/rvj/fullscreen-quitter'
import IconGithub from '~icons/simple-icons/github'
import { focusQuietly } from '../composables/focusQuietly'

defineProps<{ level: number }>()
const emit = defineEmits<{ about: []; collection: []; sound: []; reset: []; resetLevel: [] }>()

const open = ref(false)
const warm = () => prefetch(loadAbout, loadCollection, loadReset, loadSound) // les boîtes de dialogue sont des chunks à part
const startBtn = useTemplateRef<HTMLButtonElement>('startBtn')
const menu = useTemplateRef<HTMLElement>('menu')
const items = () => Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

const close = (refocus = false) => {
  open.value = false
  if (refocus) focusQuietly(startBtn.value)
}
const toggle = async () => {
  warm()
  open.value = !open.value
  if (open.value) {
    await nextTick()
    focusQuietly(items()[0])
  }
}
// Plein écran sur la page entière ; API absente (p. ex. Safari iPhone) : ni icône ni entrée de menu.
// État lu sur document.fullscreenElement : useFullscreen de VueUse se fie à webkitIsFullScreen dans Chromium, qui peut se dire actif sans élément plein écran.
const canFullscreen = ref(false)
const isFullscreen = ref(false)
const syncFullscreen = () => (isFullscreen.value = !!document.fullscreenElement)
onMounted(() => {
  canFullscreen.value = document.fullscreenEnabled === true
  syncFullscreen()
})
useEventListener(() => globalThis.document, 'fullscreenchange', syncFullscreen)
const fullscreenLabel = computed(() => (isFullscreen.value ? 'Quitter le plein écran' : 'Passer en plein écran'))
const switchFullscreen = () => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
const chooseFullscreen = () => {
  close(true)
  switchFullscreen()
}
const choose = (e: 'about' | 'collection' | 'sound' | 'reset') => {
  close(e === 'collection' || e === 'sound') // le focus revient sur « Démarrer » avant l’ouverture : c’est là que la fenêtre le rendra
  if (e === 'about') emit('about')
  else if (e === 'collection') emit('collection')
  else if (e === 'sound') emit('sound')
  else emit('reset')
}
onClickOutside(menu, () => close(), { ignore: [startBtn] })

const onMenuKey = (e: KeyboardEvent) => {
  const list = items()
  const i = list.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    close(true)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    list[(i + 1) % list.length]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    list[(i - 1 + list.length) % list.length]?.focus()
  } else if (e.key === 'Home') {
    e.preventDefault()
    list[0]?.focus()
  } else if (e.key === 'End') {
    e.preventDefault()
    list[list.length - 1]?.focus()
  } else if (e.key === 'Tab') close()
}

// Bulle de notification (une à la fois, file d’attente) : « Titre|Texte », disparaît seule après 7 s.
const session = useSessionStore()
const BALLOON_MS = 7000
const balloon = computed(() => {
  const n = session.notifications[0]
  if (!n) return null
  const [title = '', ...rest] = n.text.split('|')
  return rest.length > 0 ? { id: n.id, title, text: rest.join('|') } : { id: n.id, title: '', text: title }
})
const { start: startBalloonTimer, stop: stopBalloonTimer } = useTimeoutFn(() => balloon.value && session.dismiss(balloon.value.id), BALLOON_MS, { immediate: false })
watch(
  () => balloon.value?.id,
  (id) => (id === undefined ? stopBalloonTimer() : startBalloonTimer()),
  { immediate: true },
)

const nowMs = ref(Date.now())
useIntervalFn(() => (nowMs.value = Date.now()), 15000)
const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = () => `${pad(new Date(nowMs.value).getHours())}:${pad(new Date(nowMs.value).getMinutes())}`

const item =
  'flex items-center gap-2 w-full min-h-10 px-3 text-[0.9rem] text-black no-underline text-left cursor-pointer border-0 bg-transparent [font:inherit] hover:bg-[#000080] hover:text-white focus:bg-[#000080] focus:text-white focus:outline-none sm:min-h-8'
const inset = 'shadow-[inset_1px_1px_grey,inset_-1px_-1px_#fff]'
</script>

<template>
  <div
    class="taskbar fixed bottom-0 inset-x-0 z-30 flex items-stretch justify-between gap-2 bg-[#c0c0c0] text-black text-[0.85rem] pt-[2px] px-[2px] pb-[max(2px,env(safe-area-inset-bottom))] box-border shadow-[inset_0_1px_#dfdfdf,inset_0_2px_#fff] select-none [-webkit-tap-highlight-color:transparent] touch-manipulation"
  >
    <div class="relative flex">
      <button
        ref="startBtn"
        class="win-btn flex items-center gap-[0.35rem] min-w-10 min-h-10 px-2 py-0 font-bold [font:inherit] font-bold border-0 focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-[-5px]"
        :class="open ? 'shadow-[inset_-1px_-1px_#fff,inset_1px_1px_#0a0a0a,inset_-2px_-2px_#dfdfdf,inset_2px_2px_grey]' : ''"
        type="button"
        aria-haspopup="menu"
        :aria-expanded="open"
        aria-controls="start-menu"
        @click="toggle"
        @pointerenter="warm"
        @focus="warm"
      >
        <IconStart class="w-4 h-4" />
        <span>Démarrer</span>
      </button>
      <div
        v-show="open"
        id="start-menu"
        ref="menu"
        class="absolute bottom-full left-0 mb-[2px] flex w-[min(17rem,calc(100vw-0.5rem))] bg-[#c0c0c0] p-[2px] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#dfdfdf,inset_-2px_-2px_grey,inset_2px_2px_#fff]"
        role="menu"
        aria-label="Menu Démarrer"
        @keydown="onMenuKey"
      >
        <div
          class="w-7 flex-none bg-gradient-to-t from-[#000080] to-[#1084d0] text-white text-[1.1rem] font-bold tracking-[0.03em] whitespace-nowrap [writing-mode:vertical-rl] rotate-180 flex items-center px-[0.2rem] pb-0"
          aria-hidden="true"
        >
          Réveillez-vous&nbsp;<span class="font-normal">98</span>
        </div>
        <div class="flex-1 min-w-0 py-[2px]">
          <button class="" :class="item" type="button" role="menuitem" tabindex="-1" @click="choose('about')">À propos</button>
          <button :class="item" type="button" role="menuitem" tabindex="-1" @click="choose('collection')">Collection</button>
          <button :class="item" type="button" role="menuitem" tabindex="-1" @click="choose('sound')">Son…</button>
          <a
            :class="item"
            href="https://github.com/EmileBrunelle/reveillez-vous-js"
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            tabindex="-1"
            aria-label="Code source sur GitHub (nouvel onglet)"
            @click="close()"
          >
            <IconGithub class="w-4 h-4 flex-none" aria-hidden="true" />
            Code source
          </a>
          <button v-if="canFullscreen" :class="item" type="button" role="menuitem" tabindex="-1" @click="chooseFullscreen">
            {{ isFullscreen ? 'Quitter le plein écran' : 'Plein écran' }}
          </button>
          <template v-if="level > 1">
            <hr class="my-[3px] mx-[2px] border-0 h-[2px] bg-transparent shadow-[inset_0_1px_grey,inset_0_-1px_#fff]" role="separator" />
            <button :class="item" type="button" role="menuitem" tabindex="-1" @click="choose('reset')">Recommencer à zéro</button>
          </template>
        </div>
      </div>
    </div>

    <div
      v-if="balloon"
      :key="balloon.id"
      class="balloon box-border absolute bottom-full right-1 mb-[10px] w-[min(18rem,calc(100vw-0.5rem))] max-sm:w-64 bg-[#ffffe1] text-black text-[0.85rem] border border-solid border-black p-[3px] shadow-[2px_2px_0_rgb(0_0_0/0.35)] motion-safe:animate-[balloon-in_0.2s_ease-out_both]"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-center gap-1 min-h-6">
        <span class="flex-none grid place-items-center w-4 h-4 rounded-full bg-[#000080] text-white text-[0.7rem] font-bold leading-none" aria-hidden="true">i</span>
        <strong v-if="balloon.title" class="flex-1 min-w-0 truncate">{{ balloon.title }}</strong>
        <span v-else class="flex-1" />
        <button
          class="flex-none grid place-items-center w-6 h-6 p-0 border-0 bg-transparent text-black cursor-pointer text-[1rem] leading-none hover:bg-[#c0c0c0] focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black"
          type="button"
          aria-label="Fermer la notification"
          @click="session.dismiss(balloon.id)"
        >
          ×
        </button>
      </div>
      <p class="m-0 px-[2px] pb-[3px] pt-[2px]">{{ balloon.text }}</p>
      <span class="absolute -bottom-[6px] right-5 w-[10px] h-[10px] bg-[#ffffe1] border-0 border-r border-b border-solid border-black rotate-45" aria-hidden="true" />
    </div>

    <div class="flex items-stretch gap-1 pl-1 pr-1 bg-[#c0c0c0]" :class="inset">
      <Vigilance :level="level" class="flex items-center min-h-10 min-w-10 justify-center" @reset="emit('resetLevel')" />
      <button
        class="grid place-items-center w-10 min-h-10 p-0 border-0 bg-transparent cursor-pointer text-black focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-[-4px]"
        type="button"
        aria-label="Couper le son"
        :aria-pressed="muted"
        :title="muted ? 'Son coupé' : 'Son actif'"
        @click="muted = !muted"
      >
        <IconSoundOff v-if="muted" class="w-4 h-4" />
        <IconSound v-else class="w-4 h-4" />
      </button>
      <button
        v-if="canFullscreen"
        class="grid place-items-center w-10 min-h-10 p-0 border-0 bg-transparent cursor-pointer text-black focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-[-4px]"
        type="button"
        :aria-label="fullscreenLabel"
        :aria-pressed="isFullscreen"
        :title="fullscreenLabel"
        @click="switchFullscreen"
      >
        <IconFullscreenExit v-if="isFullscreen" class="w-4 h-4" />
        <IconFullscreen v-else class="w-4 h-4" />
      </button>
      <time class="self-center px-1 tabular-nums" :datetime="new Date(nowMs).toISOString()">{{ hhmm() }}</time>
    </div>
  </div>
</template>

<style scoped>
@keyframes balloon-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
