<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { animate, useReducedMotion } from 'motion-v'
import TarotEmblem from './TarotEmblem.vue'
import { cardDeal, cardFlip } from '../audio/sfx'
import type { Arcane } from '../engine/prophecy'
import { secureRng } from '../engine/rng'

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
// max = min(5% of card width, 26px); floor = 11px (a longest level-5 prophecy must fit a 360x640 phone).
const MIN_PX = 11
const MAX_PX = 26
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
    let hi = Math.max(lo, Math.min(MAX_PX, w * 0.05))
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
let ro: ResizeObserver | undefined
watch(() => [props.body, props.title], () => scheduleFit(true))

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
let glitchTimers: number[] = []
let glitchArmed = false
const glitch = () => {
  const bands = root.value?.querySelectorAll<HTMLElement>('.tarot__numero, .tarot__emblem, .tarot__title, .tarot__verse, .tarot__banner')
  const content = root.value?.querySelector<HTMLElement>('.tarot__content')
  if (!bands?.length || !content) return
  const dur = 80 + rng() * 70
  const dx = (2 + rng() * 4) * (rng() < 0.5 ? -1 : 1)
  const split = 1 + rng() * 2
  bands[Math.floor(rng() * bands.length)].animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: dur, easing: 'steps(2, jump-none)' })
  content.animate(
    [{ textShadow: `${split}px 0 rgb(255 0 0 / 0.5), ${-split}px 0 rgb(0 160 160 / 0.5)` }, { textShadow: 'none' }],
    { duration: dur, easing: 'steps(2, jump-none)' },
  )
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
const onMove = (e: PointerEvent) => {
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
const onLeave = () => {
  cancelAnimationFrame(raf)
  const s = tiltEl.value?.style
  if (!s) return
  s.setProperty('--ry', '0deg')
  s.setProperty('--rx', '0deg')
  s.setProperty('--glare', '0')
}

onMounted(() => {
  window.addEventListener('pointermove', onMove)
  document.addEventListener('pointerleave', onLeave)
  if (root.value) {
    ro = new ResizeObserver(() => scheduleFit())
    ro.observe(root.value)
  }
  scheduleFit(true)
  void document.fonts?.ready.then(() => scheduleFit(true))
  void deal()
})
onUnmounted(() => {
  ro?.disconnect()
  cancelAnimationFrame(fitRaf)
  skipped = true
  window.clearTimeout(timer)
  glitchTimers.forEach(clearTimeout)
  cancelAnimationFrame(raf)
  running.forEach((r) => r.stop())
  window.removeEventListener('pointermove', onMove)
  document.removeEventListener('pointerleave', onLeave)
})
</script>

<template>
  <div ref="root" class="tarot" :class="`tarot--l${level}`" @click="skip">
    <div class="tarot__sr" role="status" aria-live="polite">{{ faceUp ? `${title} ${body} ${verse}` : '' }}</div>
    <div class="tarot__stage">
    <div ref="dealEl" class="tarot__deal">
      <div ref="tiltEl" class="tarot__tilt">
        <div ref="flipEl" class="tarot__flip">
          <div class="tarot__face tarot__front" :class="{ 'tarot__face--up': faceUp }" :aria-hidden="!faceUp">
            <div class="tarot__content" :style="{ '--title': `${titleSize}cqw` }">
              <span class="tarot__corner tarot__corner--tl" /><span class="tarot__corner tarot__corner--tr" />
              <span class="tarot__corner tarot__corner--bl" /><span class="tarot__corner tarot__corner--br" />
              <div class="tarot__numero">{{ arcane.numero }}</div>
              <div class="tarot__emblem"><TarotEmblem :symbole="arcane.symbole" /></div>
              <h2 class="tarot__title" :data-text="title">{{ title }}</h2>
              <div ref="panelEl" class="tarot__panel"><p ref="bodyEl" class="tarot__body">{{ body }}</p></div>
              <p class="tarot__verse">— {{ verse }}</p>
              <div class="tarot__banner">{{ arcane.nom }}</div>
            </div>
            <div class="tarot__glare" />
          </div>
          <div class="tarot__face tarot__back" :class="{ 'tarot__face--up': faceUp }" :aria-hidden="faceUp">
            <div class="tarot__backframe">
              <TarotEmblem class="tarot__backeye" symbole="eye" />
            </div>
            <div class="tarot__glare" />
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.tarot {
  --tarot-ink: #1f1038;
  --tarot-gold: #b9821a;
  --tarot-paper: #f3e3b3;
  /* Fits its slot (.tarot-slot is a size container) while keeping the 7:12 ratio. */
  width: min(100cqw, calc(100cqh * 7 / 12));
  aspect-ratio: 7 / 12;
  /* Containment lives here, OUTSIDE the 3D chain (Firefox flattens preserve-3d through contained elements). */
  container-type: inline-size;
  position: relative;
}
.tarot__sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.tarot__stage { position: absolute; inset: 0; perspective: 1100px; }
.tarot__deal, .tarot__tilt, .tarot__flip { position: absolute; inset: 0; transform-style: preserve-3d; }
.tarot__tilt { transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)); transition: transform 0.12s ease-out; }
.tarot__face {
  position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden;
  border-radius: 4cqw; overflow: hidden; box-shadow: 1.5cqw 1.5cqw 0 #000; border: 1.2cqw solid var(--tarot-ink);
}
/* Belt and braces: explicit visibility by side, in case a browser flattens the 3D context and backface-visibility is ignored. */
.tarot__front:not(.tarot__face--up), .tarot__back.tarot__face--up { visibility: hidden; }
.tarot__front { background: var(--tarot-paper); color: var(--tarot-ink); transform: rotateY(180deg); text-align: left; }
.tarot__content {
  position: absolute; inset: 1.6cqw; border: 0.6cqw solid var(--tarot-gold); outline: 0.5cqw solid var(--tarot-ink); outline-offset: -2.2cqw;
  display: flex; flex-direction: column; align-items: center; padding: 3.4cqw 4.6cqw 0; gap: 1.6cqw; font-family: Georgia, 'Times New Roman', serif;
}
.tarot__corner { position: absolute; width: 3.4cqw; height: 3.4cqw; background: var(--tarot-gold); transform: rotate(45deg); }
.tarot__corner--tl { top: -1.5cqw; left: -1.5cqw; } .tarot__corner--tr { top: -1.5cqw; right: -1.5cqw; }
.tarot__corner--bl { bottom: -1.5cqw; left: -1.5cqw; } .tarot__corner--br { bottom: -1.5cqw; right: -1.5cqw; }
.tarot__numero { font-size: 6cqw; font-weight: bold; letter-spacing: 0.15em; line-height: 1; padding: 0.6cqw 4cqw; border-block: 0.5cqw solid var(--tarot-gold); }
.tarot__emblem { flex: 0 0 24cqw; width: 24cqw; color: var(--tarot-ink); }
.tarot[data-emblem='small'] .tarot__emblem { flex-basis: 12cqw; width: 12cqw; }
.tarot[data-emblem='none'] .tarot__emblem { display: none; }
.tarot__title { margin: 0; font-size: var(--title); line-height: 1.15; text-align: center; text-transform: uppercase; overflow-wrap: anywhere; }
.tarot__panel { flex: 1 1 0; min-height: 0; width: 100%; overflow: hidden; display: flex; background: rgb(255 249 228 / 0.6); border: 0.5cqw solid var(--tarot-gold); padding: 2cqw 2.4cqw; }
.tarot__body { margin: auto 0; font-size: 16px; line-height: 1.3; color: #170a2b; overflow-wrap: anywhere; }
.tarot__verse { margin: 0; font-size: 3.8cqw; font-style: italic; text-align: right; align-self: stretch; }
.tarot__banner { align-self: stretch; margin: 0 -4.6cqw; padding: 1.8cqw 2cqw; background: var(--tarot-ink); color: var(--tarot-paper); text-align: center; font-size: 4.2cqw; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; overflow-wrap: anywhere; line-height: 1.15; }
.tarot__glare {
  position: absolute; inset: 0; pointer-events: none; opacity: var(--glare, 0); transition: opacity 0.2s;
  background: radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgb(255 255 255 / 0.3), rgb(255 255 255 / 0) 55%);
}
.tarot__tilt { --glare: 0; }
.tarot__back {
  background:
    repeating-linear-gradient(45deg, transparent 0 3cqw, rgb(185 130 26 / 0.35) 3cqw 3.6cqw),
    repeating-linear-gradient(-45deg, transparent 0 3cqw, rgb(185 130 26 / 0.35) 3cqw 3.6cqw),
    #3a1f66;
}
.tarot__backframe { position: absolute; inset: 3cqw; border: 0.8cqw solid var(--tarot-gold); outline: 0.5cqw solid var(--tarot-paper); outline-offset: -2.4cqw; display: grid; place-items: center; }
.tarot__backeye { width: 52cqw; height: 52cqw; color: var(--tarot-gold); background: #3a1f66; border-radius: 50%; padding: 6cqw; border: 0.8cqw solid var(--tarot-gold); }

@media (prefers-reduced-motion: reduce) { .tarot__tilt { transition: none; } }
</style>
