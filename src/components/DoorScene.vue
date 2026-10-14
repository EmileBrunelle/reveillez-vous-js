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
    <div ref="stage" class="stage">
      <div class="doorway" aria-hidden="true">
        <div ref="glow" class="doorway__glow" />
        <div ref="seer" class="doorway__seer"><Seer /></div>
      </div>
      <div ref="spill" class="spill" aria-hidden="true" />
      <div ref="leaf" class="door" role="img" :aria-label="door.label">
        <component :is="door.component" />
      </div>
      <button v-if="!closing" class="door-hit" type="button" aria-label="Ouvrir la porte" @click="open" />
      <div ref="dustLayer" class="dust" aria-hidden="true">
        <span v-for="n in 10" :key="n" class="dust__p" />
      </div>
    </div>
    <div v-if="!closing" ref="ui" class="scene scene--ui">
      <p class="lead">{{ line }}</p>
      <p class="hint" aria-hidden="true" :class="{ 'hint--on': hint }">(Touchez la porte)</p>
      <SiteFooter @about="emit('about')" />
    </div>
  </section>
</template>

<style scoped>
.stage { height: clamp(10rem, 45dvh, 28rem); width: auto; aspect-ratio: 120 / 190; }
.scene { gap: 0.75rem; }
.door-hit { position: absolute; inset: 0; z-index: 3; padding: 0; margin: 0; border: 0; background: transparent; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.door-hit:focus-visible { outline: 3px solid var(--accent); outline-offset: 6px; }
.door-hit::after { content: ''; position: absolute; left: 6%; right: 6%; bottom: -3px; height: 4px; background: var(--accent); box-shadow: 0 0 14px 4px rgb(255 226 140 / 0.8); opacity: 0; transition: opacity 0.2s; }
.door-hit:is(:hover, :focus-visible)::after { opacity: 1; }
.door :deep(.door-svg) { transform-origin: 0 50%; transition: transform 0.25s, filter 0.25s; }
.stage:has(.door-hit:is(:hover, :focus-visible)) .door :deep(.door-svg) { transform: perspective(700px) rotateY(-5deg); filter: drop-shadow(0 0 10px rgb(255 226 140 / 0.55)); }
.hint { margin: 0; font-size: 0.9rem; opacity: 0; min-height: 1.35em; transition: opacity 0.6s; }
.hint--on { opacity: 0.85; }
@media (prefers-reduced-motion: reduce) {
  .stage:has(.door-hit:is(:hover, :focus-visible)) .door :deep(.door-svg) { transform: none; }
}
@media (max-height: 30rem) and (orientation: landscape) {
  .scene:not(.scene--ui) { grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 1.5rem; max-width: 44rem; }
}
</style>
