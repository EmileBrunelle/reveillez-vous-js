<script setup lang="ts">
import SiteFooter from './SiteFooter.vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { animate, useReducedMotion } from 'motion-v'
import type { SceneVariant } from '../content/scenes'
import { creak, scheduleKnocks, slam, unlock, type KnockHandle } from '../audio/sfx'
import Seer from './Seer.vue'

const props = defineProps<{ door: SceneVariant; line: string; level: number; closing?: boolean }>()
const emit = defineEmits<{ open: []; about: []; impact: [number]; closed: [] }>()
const reduced = useReducedMotion()

const stage = ref<HTMLElement>()
const leaf = ref<HTMLElement>()
const glow = ref<HTMLElement>()
const spill = ref<HTMLElement>()
const seer = ref<HTMLElement>()
const dustLayer = ref<HTMLElement>()
const ui = ref<HTMLElement>()
const hint = ref(false)

type State = 'idle' | 'opening' | 'gone'
let state: State = 'idle'
const isGone = () => state === 'gone'
let knocks: KnockHandle | null = null
let timers: number[] = []
let running: { stop: () => void }[] = []
let dustAt = 0
const DUST = 10
const OPEN_DEG = 72

const go = (el: Element | NodeListOf<Element> | undefined | null, kf: Record<string, unknown>, opt: Record<string, unknown> = {}) => {
  if (!el) return Promise.resolve()
  const c = animate(el, kf as never, opt as never)
  running.push(c)
  return Promise.resolve(c).catch(() => undefined)
}
const snap = (el: Element | NodeListOf<Element> | undefined | null, kf: Record<string, unknown>) => go(el, kf, { duration: 0 })
const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))
const halt = () => {
  knocks?.cancel()
  timers.forEach(clearTimeout)
  timers = []
  running.forEach((r) => r.stop())
  running = []
}

const dust = (n: number) => {
  const layer = dustLayer.value
  if (!layer || reduced.value) return
  const w = layer.offsetWidth
  Array.from({ length: n }).forEach(() => {
    const el = layer.children[dustAt++ % DUST] as HTMLElement
    const x = Math.random() * w
    go(el, { x: [x, x + (Math.random() - 0.5) * 24], y: [0, 40 + Math.random() * 80], opacity: [0.9, 0] }, { duration: 0.6 + Math.random() * 0.6, ease: 'easeIn' })
  })
}

const onKnock = (_i: number, intensity: number) => {
  const el = leaf.value
  if (!el) return
  if (knocks && _i >= knocks.times.length - 1) timers.push(window.setTimeout(() => (hint.value = true), 6000))
  if (reduced.value) {
    go(el, { opacity: [0.8, 1] }, { duration: 0.15 })
    return
  }
  const dir = Math.random() < 0.5 ? -1 : 1
  const amp = 2 + 5 * intensity
  snap(el, { x: dir * amp, rotateZ: dir * (0.6 + 1.4 * intensity) })
  go(el, { x: 0, rotateZ: 0 }, { type: 'spring', stiffness: 700, damping: 11 })
  const handles = el.querySelectorAll('.door-handle')
  if (handles.length) {
    snap(handles, { rotate: 25 * dir })
    go(handles, { rotate: 0 }, { type: 'spring', stiffness: 500, damping: 6 })
  }
  dust(2 + Math.round(intensity * 4))
}

onMounted(async () => {
  if (props.closing) return slamShut()
  go(ui.value, { opacity: [0, 1] }, { duration: 0.3 })
  await wait(350)
  if (state === 'idle') knocks = scheduleKnocks(props.level, onKnock)
})
onUnmounted(halt)

const open = async () => {
  if (state === 'opening') return finish()
  if (state !== 'idle') return
  state = 'opening'
  hint.value = false
  unlock()
  halt()
  snap(leaf.value, { x: 0, rotateZ: 0 })
  creak()
  if (reduced.value) {
    go(leaf.value, { opacity: 0 }, { duration: 0.2 })
    go(glow.value, { opacity: 1 }, { duration: 0.2 })
    go(seer.value, { opacity: 1 }, { duration: 0.2 })
    await wait(400)
    return finish()
  }
  go(leaf.value, { rotateY: OPEN_DEG }, { duration: 0.75, ease: [0.3, 0, 0.2, 1] })
  go(glow.value, { opacity: [0, 1] }, { duration: 0.5 })
  go(spill.value, { opacity: [0, 1], scaleX: [0.1, 1], scaleY: [0.2, 1] }, { duration: 0.7, ease: 'easeOut' })
  go(seer.value, { opacity: [0, 1], y: [10, 0], scale: [0.9, 1] }, { duration: 0.4, delay: 0.3 })
  await wait(750)
  if (state !== 'opening') return
  go(ui.value, { opacity: 0 }, { duration: 0.2 })
  go(stage.value, { scale: 2.6 }, { duration: 0.4, ease: [0.5, 0, 0.9, 0.5] })
  await wait(400)
  finish()
}

const finish = () => {
  if (state === 'gone') return
  state = 'gone'
  halt()
  emit('open')
}

const slamShut = async () => {
  state = 'opening'
  const full = reduced.value
  if (full) snap(leaf.value, { opacity: 0 })
  else snap(leaf.value, { rotateY: OPEN_DEG })
  snap(glow.value, { opacity: 1 })
  snap(spill.value, { opacity: 1 })
  snap(seer.value, { opacity: 1 })
  await wait(250)
  if (isGone()) return
  if (!full) await go(leaf.value, { rotateY: -4 }, { duration: 0.14, ease: [0.6, 0, 1, 1] })
  if (isGone()) return
  slam()
  emit('impact', 1)
  dust(8)
  go(glow.value, { opacity: 0 }, { duration: 0.1 })
  go(spill.value, { opacity: 0 }, { duration: 0.1 })
  go(seer.value, { opacity: 0 }, { duration: 0.1 })
  if (full) go(leaf.value, { opacity: 1 }, { duration: 0.15 })
  else go(leaf.value, { rotateY: 0 }, { type: 'spring', stiffness: 500, damping: 9 })
  await wait(550)
  closed()
}

const closed = () => {
  if (state === 'gone') return
  state = 'gone'
  halt()
  emit('closed')
}

const onSceneClick = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button')) return
  if (props.closing) closed()
  else if (state === 'opening') finish()
}
</script>

<template>
  <section class="scene" @click="onSceneClick">
    <div ref="stage" data-stage class="relative w-auto h-[clamp(10rem,45dvh,28rem)] aspect-[120/190] [perspective:900px] origin-[50%_45%] select-none [-webkit-tap-highlight-color:transparent]">
      <div class="absolute inset-0" aria-hidden="true">
        <div ref="glow" class="absolute inset-[3%_5%_0] opacity-0 [background:radial-gradient(ellipse_at_50%_60%,#fff6c8_0%,#ffd56a_45%,#7a4a10_100%)]" />
        <div ref="seer" class="absolute left-1/2 bottom-0 w-[38%] -ml-[19%] opacity-0 [&_.seer]:block [&_.seer]:w-full"><Seer /></div>
      </div>
      <div ref="spill" class="absolute -left-[45%] -right-[45%] top-[8%] h-[130%] opacity-0 origin-[50%_0] [clip-path:polygon(33%_0,67%_0,100%_100%,0_100%)] [background:linear-gradient(to_bottom,rgb(255_226_140/0.7),rgb(255_226_140/0))] pointer-events-none" aria-hidden="true" />
      <div ref="leaf" data-leaf class="absolute inset-0 origin-[0_50%] backface-hidden select-none [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]" role="img" :aria-label="door.label">
        <component :is="door.component" />
      </div>
      <button v-if="!closing" class="door-hit absolute inset-0 z-3 p-0 m-0 border-0 bg-transparent cursor-pointer [-webkit-tap-highlight-color:transparent] focus-visible:[outline:3px_solid_var(--accent)] focus-visible:outline-offset-[6px]" type="button" aria-label="Ouvrir la porte" @click="open" />
      <div ref="dustLayer" class="absolute inset-x-0 top-0 h-0 pointer-events-none" aria-hidden="true">
        <span v-for="n in 10" :key="n" class="absolute top-0 left-0 w-[3px] h-[3px] bg-[#c9b79a] opacity-0" />
      </div>
    </div>
    <div v-if="!closing" ref="ui" class="scene scene--ui">
      <p class="lead">{{ line }}</p>
      <p class="m-0 text-[0.9rem] min-h-[1.35em] [transition:opacity_0.6s]" aria-hidden="true" :class="hint ? 'opacity-[0.85]' : 'opacity-0'">(Touchez la porte)</p>
      <SiteFooter @about="emit('about')" />
    </div>
  </section>
</template>

<style scoped>
/* Reste en CSS: .scene (gap > règle globale), ::after décoratif, :has/:deep, paysage. */
.scene { gap: 0.75rem; }
.scene--ui { max-width: none; }
.door-hit::after { content: ''; position: absolute; left: 6%; right: 6%; bottom: -3px; height: 4px; background: var(--accent); box-shadow: 0 0 14px 4px rgb(255 226 140 / 0.8); opacity: 0; transition: opacity 0.2s; }
.door-hit:is(:hover, :focus-visible)::after { opacity: 1; }
[data-leaf] :deep(svg) { transform-origin: 0 50%; transition: transform 0.25s, filter 0.25s; }
[data-stage]:has(.door-hit:is(:hover, :focus-visible)) [data-leaf] :deep(svg) { transform: perspective(700px) rotateY(-5deg); filter: drop-shadow(0 0 10px rgb(255 226 140 / 0.55)); }
@media (prefers-reduced-motion: reduce) {
  [data-stage]:has(.door-hit:is(:hover, :focus-visible)) [data-leaf] :deep(svg) { transform: none; }
}
@media (max-height: 30rem) and (orientation: landscape) {
  .scene:not(.scene--ui) { grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 1.5rem; max-width: 44rem; }
}
</style>
