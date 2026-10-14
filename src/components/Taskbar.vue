<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { onClickOutside, useIntervalFn } from '@vueuse/core'
import { muted } from '../audio/sfx'
import Vigilance from './Vigilance.vue'
import IconGithub from '~icons/simple-icons/github'

defineProps<{ level: number }>()
const emit = defineEmits<{ about: []; reset: []; resetLevel: [] }>()

const open = ref(false)
const startBtn = useTemplateRef<HTMLButtonElement>('startBtn')
const menu = useTemplateRef<HTMLElement>('menu')
const items = () => Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

const close = (refocus = false) => {
  open.value = false
  if (refocus) startBtn.value?.focus()
}
const toggle = async () => {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    items()[0]?.focus()
  }
}
const choose = (e: 'about' | 'reset') => {
  close()
  if (e === 'about') emit('about')
  else emit('reset')
}
onClickOutside(menu, () => close(), { ignore: [startBtn] })

const onMenuKey = (e: KeyboardEvent) => {
  const list = items()
  const i = list.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true) }
  else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus() }
  else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus() }
  else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus() }
  else if (e.key === 'Tab') close()
}

const nowMs = ref(Date.now())
useIntervalFn(() => (nowMs.value = Date.now()), 15000)
const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = () => `${pad(new Date(nowMs.value).getHours())}:${pad(new Date(nowMs.value).getMinutes())}`

const item = 'flex items-center gap-2 w-full min-h-10 px-3 text-[0.9rem] text-black no-underline text-left cursor-pointer border-0 bg-transparent [font:inherit] hover:bg-[#000080] hover:text-white focus:bg-[#000080] focus:text-white focus:outline-none sm:min-h-8'
const inset = 'shadow-[inset_1px_1px_grey,inset_-1px_-1px_#fff]'
</script>

<template>
  <div class="taskbar fixed bottom-0 inset-x-0 z-30 flex items-stretch justify-between gap-2 bg-[#c0c0c0] text-black text-[0.85rem] pt-[2px] px-[2px] pb-[max(2px,env(safe-area-inset-bottom))] box-border shadow-[inset_0_1px_#dfdfdf,inset_0_2px_#fff] select-none [-webkit-tap-highlight-color:transparent] touch-manipulation">
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
      >
        <svg class="w-4 h-4" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M1 3l6-1v6H1z" fill="#f00" /><path d="M8 2l7-1v7H8z" fill="#0a0" /><path d="M1 9h6v6l-6-1z" fill="#00f" /><path d="M8 9h7v6l-7-1z" fill="#fc0" />
        </svg>
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
        <div class="w-7 flex-none bg-gradient-to-t from-[#000080] to-[#1084d0] text-white text-[1.1rem] font-bold tracking-[0.03em] whitespace-nowrap [writing-mode:vertical-rl] rotate-180 flex items-center px-[0.2rem] pb-0" aria-hidden="true">Réveillez-vous&nbsp;<span class="font-normal">98</span></div>
        <div class="flex-1 min-w-0 py-[2px]">
          <button class="" :class="item" type="button" role="menuitem" tabindex="-1" @click="choose('about')">À propos</button>
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
          <a
            :class="item"
            href="https://en.wikipedia.org/wiki/Terry_A._Davis"
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            tabindex="-1"
            aria-label="Hommage à Terry A. Davis (1969–2018), Wikipédia (nouvel onglet)"
            @click="close()"
          >Hommage à Terry A. Davis (1969–2018)</a>
          <template v-if="level > 1">
            <hr class="my-[3px] mx-[2px] border-0 h-[2px] bg-transparent shadow-[inset_0_1px_grey,inset_0_-1px_#fff]" role="separator" />
            <button :class="item" type="button" role="menuitem" tabindex="-1" @click="choose('reset')">Recommencer à zéro</button>
          </template>
        </div>
      </div>
    </div>

    <div class="flex items-stretch gap-1 pl-1 pr-1 bg-[#c0c0c0]" :class="inset">
      <Vigilance :level="level" class="flex items-center min-h-10 min-w-10 justify-center" @reset="emit('resetLevel')" />
      <button class="grid place-items-center w-10 min-h-10 p-0 border-0 bg-transparent cursor-pointer text-black focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-[-4px]" type="button" aria-label="Couper le son" :aria-pressed="muted" :title="muted ? 'Son coupé' : 'Son actif'" @click="muted = !muted">
        <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M1 6h3l4-3.5v11L4 10H1z" />
          <template v-if="muted"><path d="M10 5.5l5 5M15 5.5l-5 5" stroke="currentColor" stroke-width="1.6" fill="none" /></template>
          <template v-else><path d="M10.5 5.5a3.5 3.5 0 010 5M12.5 3.5a6.5 6.5 0 010 9" stroke="currentColor" stroke-width="1.4" fill="none" /></template>
        </svg>
      </button>
      <time class="self-center px-1 tabular-nums" :datetime="new Date(nowMs).toISOString()">{{ hhmm() }}</time>
    </div>
  </div>
</template>
