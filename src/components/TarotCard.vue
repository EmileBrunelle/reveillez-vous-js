<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { animate } from 'motion-v'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import TarotEmblem from './TarotEmblem.vue'
import { cardDeal, cardFlip } from '../audio/sfx'
import type { Arcane } from '../engine/prophecy'
import { secureRng } from '../engine/rng'
import { useDeviceTilt } from '../composables/useTilt'
import { useReducedMotion } from '../composables/useReducedMotion'

const props = withDefaults(defineProps<{ arcane: Arcane; title: string; body: string; verse: string; faceDown?: boolean; level?: number }>(), {
  faceDown: false,
  level: 1,
})
const emit = defineEmits<{ dealt: []; flipped: [] }>()
const reduced = useReducedMotion()

const root = ref<HTMLElement>()
const dealEl = ref<HTMLElement>()
const tiltEl = ref<HTMLElement>()
const flipEl = ref<HTMLElement>()

// Face-up flag drives aria and the tilt; `faceUp` lags `faceDown` until the flip lands.
const faceUp = ref(false)
const settled = ref(false)

// Title size by length (container-width units); body size is fitted in px by fitBody() (grows and shrinks).
const titleSize = computed(() => {
  const n = props.title.length
  return n < 40 ? 5.4 : n < 70 ? 4.6 : 3.9
})
const panelEl = ref<HTMLElement>()
const bodyEl = ref<HTMLElement>()
// Largest font size (px) in [MIN_PX, max] for which the body fits the panel without scrolling.
// Uses layout sizes (offset/client/scroll*), which ignore the deal/flip/tilt transforms.
// max = min(9% of card width, 34px); floor = 11px (a longest level-5 prophecy must fit a 360x640 phone).
const MIN_PX = 11
const MAX_PX = 34
let lastW = 0
let lastH = 0
let fitRaf = 0
// Coalesces every trigger into one rAF; unless forced (content/fonts changed), skips when the card size is unchanged.
const scheduleFit = (force = false) => {
  if (force) lastW = lastH = 0
  if (fitRaf) return
  fitRaf = requestAnimationFrame(() => {
    fitRaf = 0
    fitBody()
  })
}
const fitBody = () => {
  const panel = panelEl.value
  const body = bodyEl.value
  const w = root.value?.offsetWidth
  const h = root.value?.offsetHeight
  if (!panel || !body || !w || !h || !panel.clientHeight) return
  if (w === lastW && h === lastH) return
  lastW = w
  lastH = h
  const cs = getComputedStyle(panel)
  const room = panel.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
  const fits = (px: number) => {
    body.style.fontSize = `${px}px`
    return body.offsetHeight <= room + 0.5 && panel.scrollHeight <= panel.clientHeight + 1
  }
  // Try the full emblem, then a half-size one, then none: the font never drops below MIN_PX.
  for (const emb of ['', 'small', 'none']) {
    const el = root.value!
    if (emb) el.dataset.emblem = emb
    else delete el.dataset.emblem
    let lo = MIN_PX
    let hi = Math.max(lo, Math.min(MAX_PX, w * 0.09))
    if (fits(hi)) return
    if (emb !== 'none' && !fits(lo)) continue
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2
      if (fits(mid)) lo = mid
      else hi = mid
    }
    body.style.fontSize = `${lo}px`
    return
  }
}
watch(
  () => [props.body, props.title],
  () => scheduleFit(true),
)

let skipped = false
let running: { stop: () => void }[] = []
let timer = 0
const go = (el: Element | undefined, kf: Record<string, unknown>, opt: Record<string, unknown> = {}) => {
  if (!el) return Promise.resolve()
  const c = animate(el, kf as never, opt as never)
  running.push(c)
  return Promise.resolve(c).catch(() => undefined)
}
const snap = (el: Element | undefined, kf: Record<string, unknown>) => go(el, kf, { duration: 0 })
const wait = (ms: number) => new Promise<void>((r) => (timer = window.setTimeout(r, ms)))

const rest = (down: boolean) => {
  snap(dealEl.value, { x: 0, y: 0, scale: 1, rotateZ: 0, opacity: 1 })
  snap(flipEl.value, { rotateY: down ? 0 : 180 })
  faceUp.value = !down
  settled.value = true
}

const flip = async (toFaceUp: boolean) => {
  if (reduced.value) {
    rest(!toFaceUp)
    emit('flipped')
    return
  }
  settled.value = false
  cardFlip()
  const lift = go(dealEl.value, { scale: [1, 1.14, 0.97, 1.04, 1], rotateZ: [0, -3, 2, -1, 0] }, { duration: 0.6, ease: 'easeOut' })
  const turn = go(flipEl.value, { rotateY: toFaceUp ? 180 : 0 }, { type: 'spring', stiffness: 110, damping: 13 })
  await wait(180)
  if (skipped) return
  faceUp.value = toFaceUp
  await Promise.all([lift, turn])
  if (skipped) return
  settled.value = true
  emit('flipped')
}

const deal = async () => {
  if (reduced.value) {
    snap(flipEl.value, { rotateY: props.faceDown ? 0 : 180 })
    faceUp.value = !props.faceDown
    snap(dealEl.value, { opacity: 0, x: 0, y: 0, scale: 1, rotateZ: 0 })
    await go(dealEl.value, { opacity: [0, 1] }, { duration: 0.25 })
    settled.value = true
    emit('dealt')
    if (!props.faceDown) emit('flipped')
    return
  }
  snap(flipEl.value, { rotateY: 0 })
  snap(dealEl.value, { x: -40, y: -260, scale: 0.4, rotateZ: -18, opacity: 0 })
  cardDeal()
  go(dealEl.value, { opacity: [0, 1] }, { duration: 0.12 })
  await go(dealEl.value, { x: [-40, 0], y: [-260, 0], scale: [0.4, 1], rotateZ: [-18, 0] }, { type: 'spring', stiffness: 150, damping: 17 })
  if (skipped) return
  settled.value = true
  emit('dealt')
  if (props.faceDown) return
  await wait(250)
  if (skipped) return
  await flip(true)
}

const skip = () => {
  if (skipped) return
  skipped = true
  window.clearTimeout(timer)
  running.forEach((r) => r.stop())
  running = []
  rest(props.faceDown)
}

watch(
  () => props.faceDown,
  (down) => {
    if (!settled.value) return
    skipped = false
    void flip(!down)
  },
)

// Levels 4-5: rare one-shot "CRT hiccup" (80-150 ms): one band of the card jumps 2-6 px with a 1-3 px RGB split.
// L4: 1 per reading, L5: 1-2. Never within 2 s of the flip (faceUp turns true ~0.2 s into it); skipped under reduced motion.
// Never the prophecy body: only the numero/emblem/title/verse/banner bands move; no luminance change.
const rng = secureRng()
const glitchTimers: number[] = []
let glitchArmed = false
const glitch = () => {
  const bands = root.value?.querySelectorAll<HTMLElement>('.tarot__numero, .tarot__emblem, .tarot__title, .tarot__verse, .tarot__banner')
  const content = root.value?.querySelector<HTMLElement>('.tarot__content')
  if (!bands?.length || !content) return
  const dur = 80 + rng() * 70
  const dx = (2 + rng() * 4) * (rng() < 0.5 ? -1 : 1)
  const split = 1 + rng() * 2
  bands[Math.floor(rng() * bands.length)].animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: dur, easing: 'steps(2, jump-none)' })
  content.animate([{ textShadow: `${split}px 0 rgb(255 0 0 / 0.5), ${-split}px 0 rgb(0 160 160 / 0.5)` }, { textShadow: 'none' }], { duration: dur, easing: 'steps(2, jump-none)' })
}
const armGlitch = () => {
  if (glitchArmed || reduced.value || props.level < 4) return
  glitchArmed = true
  const n = props.level >= 5 && rng() < 0.5 ? 2 : 1
  let t = 0
  Array.from({ length: n }).forEach(() => {
    t += 2000 + rng() * 6000
    glitchTimers.push(window.setTimeout(glitch, t))
  })
}
watch(faceUp, (up) => up && armGlitch())

// Pointer tilt (mouse/pen only, max 8 deg) with a glare following the pointer.
const MAX_TILT = 8
let raf = 0
let finePointer = false // une souris/stylet a bougé : le pointeur l’emporte sur le gyroscope
const onMove = (e: PointerEvent) => {
  if (e.pointerType !== 'touch') finePointer = true
  if (reduced.value || e.pointerType === 'touch' || !settled.value || !root.value || !tiltEl.value) return
  const r = root.value.getBoundingClientRect()
  const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / r.width))
  const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / r.height))
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    const s = tiltEl.value?.style
    if (!s) return
    s.setProperty('--ry', `${dx * MAX_TILT}deg`)
    s.setProperty('--rx', `${-dy * MAX_TILT}deg`)
    s.setProperty('--gx', `${50 + dx * 60}%`)
    s.setProperty('--gy', `${50 + dy * 60}%`)
    s.setProperty('--glare', '1')
  })
}
// Gyroscope (mobile) : mêmes variables CSS que le pointeur ; la carte reste « fixe » dans le monde (sens inverse du téléphone).
// Plus ample que le pointeur : à 8°, sur un téléphone, ça ne se voyait presque pas.
const GYRO_TILT = 20
useDeviceTilt({
  enabled: () => !reduced.value && !finePointer && settled.value,
  apply: (nx, ny) => {
    const s = tiltEl.value?.style
    if (!s) return
    s.setProperty('--ry', `${-nx * GYRO_TILT}deg`)
    s.setProperty('--rx', `${ny * GYRO_TILT}deg`)
    s.setProperty('--gx', `${50 - nx * 60}%`)
    s.setProperty('--gy', `${50 - ny * 60}%`)
    s.setProperty('--glare', '1')
  },
})
const onLeave = () => {
  cancelAnimationFrame(raf)
  const s = tiltEl.value?.style
  if (!s) return
  s.setProperty('--ry', '0deg')
  s.setProperty('--rx', '0deg')
  s.setProperty('--glare', '0')
}

useEventListener(window, 'pointermove', onMove)
useEventListener(document, 'pointerleave', onLeave)
useResizeObserver(root, () => scheduleFit())

onMounted(() => {
  scheduleFit(true)
  void document.fonts?.ready.then(() => scheduleFit(true))
  void deal()
})
onUnmounted(() => {
  cancelAnimationFrame(fitRaf)
  skipped = true
  window.clearTimeout(timer)
  glitchTimers.forEach(clearTimeout)
  cancelAnimationFrame(raf)
  running.forEach((r) => r.stop())
})
</script>

<template>
  <div ref="root" class="tarot relative aspect-[7/12]" :class="`tarot--l${level}`" @click="skip">
    <div class="tarot__sr absolute size-px m-[-1px] overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" role="status" aria-live="polite">{{ faceUp ? `${title} ${body} ${verse}` : '' }}</div>
    <div class="tarot__stage absolute inset-0 [perspective:1100px]">
      <div ref="dealEl" class="tarot__deal absolute inset-0 [transform-style:preserve-3d]">
        <div ref="tiltEl" class="tarot__tilt absolute inset-0 [transform-style:preserve-3d]">
          <div ref="flipEl" class="tarot__flip absolute inset-0 [transform-style:preserve-3d]">
            <div
              class="tarot__face tarot__front absolute inset-0 overflow-hidden rounded-[4cqw] shadow-[1.5cqw_1.5cqw_0_#000] [border:1.2cqw_solid_var(--tarot-ink)] [background:var(--tarot-paper)] [color:var(--tarot-ink)] text-left"
              :class="{ 'tarot__face--up': faceUp }"
              :aria-hidden="!faceUp"
            >
              <div
                class="tarot__content absolute inset-[1.6cqw] [border:0.6cqw_solid_var(--tarot-gold)] [outline:0.5cqw_solid_var(--tarot-ink)] [outline-offset:-2.2cqw] flex flex-col items-center [padding:3.4cqw_4.6cqw_0] gap-[1.6cqw] font-card"
                :style="{ '--title': `${titleSize}cqw` }"
              >
                <span class="tarot__corner absolute size-[3.4cqw] [background:var(--tarot-gold)] [transform:rotate(45deg)] top-[-1.5cqw] left-[-1.5cqw]" /><span
                  class="tarot__corner absolute size-[3.4cqw] [background:var(--tarot-gold)] [transform:rotate(45deg)] top-[-1.5cqw] right-[-1.5cqw]"
                />
                <span class="tarot__corner absolute size-[3.4cqw] [background:var(--tarot-gold)] [transform:rotate(45deg)] bottom-[-1.5cqw] left-[-1.5cqw]" /><span
                  class="tarot__corner absolute size-[3.4cqw] [background:var(--tarot-gold)] [transform:rotate(45deg)] bottom-[-1.5cqw] right-[-1.5cqw]"
                />
                <div class="tarot__numero font-title text-[6cqw] font-bold tracking-[0.15em] leading-none [padding:0.6cqw_4cqw] [border-block:0.5cqw_solid_var(--tarot-gold)]">{{ arcane.numero }}</div>
                <div class="tarot__emblem [flex:0_0_24cqw] w-[24cqw] [color:var(--tarot-ink)]"><TarotEmblem :symbole="arcane.symbole" /></div>
                <h2 class="tarot__title font-title m-0 [font-size:var(--title)] leading-[1.15] text-center uppercase [overflow-wrap:anywhere]" :data-text="title">{{ title }}</h2>
                <div
                  ref="panelEl"
                  class="tarot__panel [flex:1_1_0] min-h-0 w-full overflow-hidden flex [background:rgb(255_249_228/0.6)] [border:0.5cqw_solid_var(--tarot-gold)] [padding:2cqw_2.4cqw]"
                >
                  <p ref="bodyEl" class="tarot__body [margin:auto_0] text-[16px] leading-[1.3] [color:#170a2b] [overflow-wrap:anywhere]">{{ body }}</p>
                </div>
                <p class="tarot__verse m-0 text-[3.8cqw] italic text-right self-stretch">— {{ verse }}</p>
                <div
                  class="tarot__banner font-title self-stretch [margin:0_-4.6cqw] [padding:1.8cqw_2cqw] [background:var(--tarot-ink)] [color:var(--tarot-paper)] text-center text-[4.2cqw] font-bold uppercase tracking-[0.06em] [overflow-wrap:anywhere] leading-[1.15]"
                >
                  {{ arcane.nom }}
                </div>
              </div>
              <div class="tarot__glare absolute inset-0 pointer-events-none [opacity:var(--glare,0)] [transition:opacity_0.2s]" />
            </div>
            <div
              class="tarot__face tarot__back absolute inset-0 overflow-hidden rounded-[4cqw] shadow-[1.5cqw_1.5cqw_0_#000] [border:1.2cqw_solid_var(--tarot-ink)]"
              :class="{ 'tarot__face--up': faceUp }"
              :aria-hidden="faceUp"
            >
              <div class="tarot__backframe absolute inset-[3cqw] [border:0.8cqw_solid_var(--tarot-gold)] [outline:0.5cqw_solid_var(--tarot-paper)] [outline-offset:-2.4cqw] grid place-items-center">
                <TarotEmblem class="tarot__backeye [color:var(--tarot-gold)] [background:#3a1f66] rounded-[50%] p-[6cqw] [border:0.8cqw_solid_var(--tarot-gold)]" symbole="eye" />
              </div>
              <div class="tarot__glare absolute inset-0 pointer-events-none [opacity:var(--glare,0)] [transition:opacity_0.2s]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Reste ici: chaîne 3D, containment, variables pilotées par JS, sélecteurs data-emblem, dégradés. Le reste est en utilitaires dans le template. */
.tarot {
  --tarot-ink: #1f1038;
  --tarot-gold: #b9821a;
  --tarot-paper: #f3e3b3;
  /* Fits its slot (.tarot-slot is a size container) while keeping the 7:12 ratio. */
  width: min(100cqw, calc(100cqh * 7 / 12));
  /* Containment lives here, OUTSIDE the 3D chain (Firefox flattens preserve-3d through contained elements). */
  container-type: inline-size;
}
.tarot__tilt {
  transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform 0.12s ease-out;
  --glare: 0;
}
.tarot__face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
/* Belt and braces: explicit visibility by side, in case a browser flattens the 3D context and backface-visibility is ignored. */
.tarot__front:not(.tarot__face--up),
.tarot__back.tarot__face--up {
  visibility: hidden;
}
.tarot__front {
  transform: rotateY(180deg);
}
.tarot[data-emblem='small'] .tarot__emblem {
  flex-basis: 12cqw;
  width: 12cqw;
}
.tarot[data-emblem='none'] .tarot__emblem {
  display: none;
}
.tarot__glare {
  background: radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgb(255 255 255 / 0.3), rgb(255 255 255 / 0) 55%);
}
.tarot__back {
  background:
    repeating-linear-gradient(45deg, transparent 0 3cqw, rgb(185 130 26 / 0.35) 3cqw 3.6cqw), repeating-linear-gradient(-45deg, transparent 0 3cqw, rgb(185 130 26 / 0.35) 3cqw 3.6cqw), #3a1f66;
}
.tarot__backeye {
  width: 52cqw;
  height: 52cqw;
}

@media (prefers-reduced-motion: reduce) {
  .tarot__tilt {
    transition: none;
  }
}
</style>
