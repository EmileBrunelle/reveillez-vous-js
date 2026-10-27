<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, useTemplateRef } from 'vue'
import { animate } from 'motion-v'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import TarotEmblem from './TarotEmblem.vue'
import TarotCardBack from './TarotCardBack.vue'
import { emblemMask } from './emblemMask'
import { cardDeal, cardFlip, cardThud } from '../audio/sfx'
import type { Arcane } from '../engine/prophecy'
import type { Paquet } from '../engine/paquets'
import { secureRng } from '../engine/rng'
import { useDeviceTilt } from '../composables/useTilt'
import { useReducedMotion } from '../composables/useReducedMotion'
import { createTapDrag } from '../composables/tapDrag'
import { createLanding } from '../composables/cardLanding'
import { useSessionStore } from '../stores/session'

const {
  arcane,
  title,
  body,
  faceDown = false,
  level = 1,
  handoff = false,
  paquet = 'nuit',
} = defineProps<{ arcane: Arcane; title: string; body: string; verse: string; faceDown?: boolean; level?: number; handoff?: boolean; paquet?: Paquet }>()
const emit = defineEmits<{ dealt: []; flipped: [] }>()
const reduced = useReducedMotion()
const session = useSessionStore()
const shimmerEl = useTemplateRef<HTMLElement>('shimmerEl')
// Pose de la carte, une seule fois par retournement : bruit sourd (toujours), ondulation CRT et reflet (jamais en mouvement réduit).
// Le reflet anime son propre élément (`.tarot__shimmer`) : ni `deal`, ni `tilt`, ni `flip` ne sont touchés, donc aucun transform partagé avec useTilt.
const landing = createLanding({
  reduced: () => reduced.value,
  thud: cardThud,
  ripple: (amp) => session.pulse(amp),
  shimmer: () => {
    shimmerEl.value?.animate(
      [
        { transform: 'translateX(-130%)', opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { opacity: 1, offset: 0.7 },
        { transform: 'translateX(130%)', opacity: 0 },
      ],
      { duration: 750, easing: 'ease-in-out' },
    )
  },
})

const root = useTemplateRef<HTMLElement>('root')
const dealEl = useTemplateRef<HTMLElement>('dealEl')
const tiltEl = useTemplateRef<HTMLElement>('tiltEl')
const flipEl = useTemplateRef<HTMLElement>('flipEl')

// Face-up flag drives aria and the tilt; `faceUp` lags `faceDown` until the flip lands.
const faceUp = ref(false)
const settled = ref(false)

// Title size by length (container-width units); body size is fitted in px by fitBody() (grows and shrinks).
const maskUrl = computed(() => emblemMask(arcane.symbole))
const titleSize = computed(() => {
  const n = title.length
  return n < 40 ? 5.4 : n < 70 ? 4.6 : 3.9
})
const panelEl = useTemplateRef<HTMLElement>('panelEl')
const bodyEl = useTemplateRef<HTMLElement>('bodyEl')
// Largest font size (px) in [MIN_PX, max] for which the body fits the panel without scrolling.
// Uses layout sizes (offset/client/scroll*), which ignore the deal/flip/tilt transforms.
// max = min(9% of card width, max(34px × max(1, width/576), 7.5% of card width)): le second terme laisse grandir les cartes très larges; floor = 11px (a longest level-5 prophecy must fit a 360x640 phone).
const MIN_PX = 11
const MAX_PX = 34
const WIDE_RATIO = 0.075 // plafond relatif des grandes cartes (≥ 453 px de large) ; téléphone et portable restent sous MAX_PX
const REF_W = 576 // largeur de carte de référence : au-delà, le plafond de police grandit avec la carte
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
  const bodyNode = bodyEl.value
  const w = root.value?.offsetWidth
  const h = root.value?.offsetHeight
  if (!panel || !bodyNode || !w || !h || !panel.clientHeight) return
  if (w === lastW && h === lastH) return
  lastW = w
  lastH = h
  const cs = getComputedStyle(panel)
  const room = panel.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
  const fits = (px: number) => {
    bodyNode.style.fontSize = `${px}px`
    return bodyNode.offsetHeight <= room + 0.5 && panel.scrollHeight <= panel.clientHeight + 1
  }
  // Try the full emblem, then a half-size one, then none: the font never drops below MIN_PX.
  for (const emb of ['', 'small', 'none']) {
    const el = root.value!
    if (emb) el.dataset.emblem = emb
    else delete el.dataset.emblem
    let lo = MIN_PX
    let hi = Math.max(lo, Math.min(w * 0.09, Math.max(MAX_PX * Math.max(1, w / REF_W), w * WIDE_RATIO)))
    if (fits(hi)) return
    if (emb !== 'none' && !fits(lo)) continue
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2
      if (fits(mid)) lo = mid
      else hi = mid
    }
    bodyNode.style.fontSize = `${lo}px`
    return
  }
}
watch(
  () => [body, title],
  () => scheduleFit(true),
)

let skipped = false
let running: { stop: () => void }[] = []
let timer = 0
const go = (el: Element | null | undefined, kf: Record<string, unknown>, opt: Record<string, unknown> = {}) => {
  if (!el) return Promise.resolve()
  const c = animate(el, kf as never, opt as never)
  running.push(c)
  return Promise.resolve(c).catch(() => undefined)
}
const snap = (el: Element | null | undefined, kf: Record<string, unknown>) => go(el, kf, { duration: 0 })
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
    if (toFaceUp) landing.land()
    emit('flipped')
    return
  }
  settled.value = false
  landing.arm()
  cardFlip()
  const lift = go(dealEl.value, { scale: [1, 1.14, 0.97, 1.04, 1], rotateZ: [0, -3, 2, -1, 0] }, { duration: 0.6, ease: 'easeOut' })
  const turn = go(flipEl.value, { rotateY: toFaceUp ? 180 : 0 }, { type: 'spring', stiffness: 120, damping: 9.5 })
  await wait(180)
  if (skipped) return
  faceUp.value = toFaceUp
  await Promise.all([lift, turn])
  if (skipped) return
  settled.value = true
  if (toFaceUp) landing.land()
  emit('flipped')
}

const deal = async () => {
  if (handoff) {
    // Relais de la coupe : la carte est déjà à sa place, dos visible, identique à la carte de DeckCut (rien à poser). On la retourne tout de suite.
    settled.value = true
    emit('dealt')
    if (faceDown) return
    await wait(reduced.value ? 150 : 140)
    if (skipped) return
    if (reduced.value) {
      rest(false)
      landing.land()
      emit('flipped')
      return
    }
    await flip(true)
    return
  }
  if (reduced.value) {
    snap(flipEl.value, { rotateY: faceDown ? 0 : 180 })
    faceUp.value = !faceDown
    snap(dealEl.value, { opacity: 0, x: 0, y: 0, scale: 1, rotateZ: 0 })
    await go(dealEl.value, { opacity: [0, 1] }, { duration: 0.25 })
    settled.value = true
    emit('dealt')
    if (!faceDown) {
      landing.land()
      emit('flipped')
    }
    return
  }
  const o = { x: -40, y: -260, scale: 0.4, rot: -18 }
  snap(flipEl.value, { rotateY: 0 })
  snap(dealEl.value, { x: o.x, y: o.y, scale: o.scale, rotateZ: o.rot, opacity: 0 })
  cardDeal()
  go(dealEl.value, { opacity: [0, 1] }, { duration: 0.12 })
  await go(dealEl.value, { x: [o.x, 0], y: [o.y, 0], scale: [o.scale, 1], rotateZ: [o.rot, 0] }, { type: 'spring', stiffness: 150, damping: 17 })
  if (skipped) return
  settled.value = true
  emit('dealt')
  if (faceDown) return
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
  rest(faceDown)
}

watch(
  () => faceDown,
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
  if (glitchArmed || reduced.value || level < 4) return
  glitchArmed = true
  const n = level >= 5 && rng() < 0.5 ? 2 : 1
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
const touchDrag = createTapDrag()
const fingerDown = ref(false) // le doigt est le seul maître de l’inclinaison pendant le contact
const onMove = (e: PointerEvent) => {
  const touch = e.pointerType === 'touch'
  if (!touch) finePointer = true
  if (touch && (!touchDrag.active || !touchDrag.move(e.clientX, e.clientY))) return
  if (reduced.value || (touch && !fingerDown.value) || !settled.value || !root.value || !tiltEl.value) return
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
  enabled: () => !reduced.value && !finePointer && settled.value && !fingerDown.value,
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
const onTouchDown = (e: PointerEvent) => {
  if (e.pointerType !== 'touch') return
  touchDrag.start(e.clientX, e.clientY)
  if (reduced.value || !settled.value) return
  fingerDown.value = true
  try {
    root.value?.setPointerCapture(e.pointerId)
  } catch {
    // capture refusée : le glissement continue de remonter jusqu’à window
  }
}
// Relâché : retour au repos sur ressort doux (transition plus longue posée le temps du retour).
let releaseTimer = 0
const onTouchUp = (e: PointerEvent) => {
  if (e.pointerType !== 'touch') return
  touchDrag.end()
  if (!fingerDown.value) return
  fingerDown.value = false
  const el = tiltEl.value
  cancelAnimationFrame(raf)
  if (!el) return
  el.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
  el.style.setProperty('--ry', '0deg')
  el.style.setProperty('--rx', '0deg')
  el.style.setProperty('--glare', '0')
  window.clearTimeout(releaseTimer)
  releaseTimer = window.setTimeout(() => el.style.removeProperty('transition'), 650)
}
// Un glissement n’est pas un tap : pas de skip à la fin du geste.
const onCardClick = () => {
  if (touchDrag.moved) return
  skip()
}
const onLeave = () => {
  cancelAnimationFrame(raf)
  const s = tiltEl.value?.style
  if (!s) return
  s.setProperty('--ry', '0deg')
  s.setProperty('--rx', '0deg')
  s.setProperty('--glare', '0')
}

useEventListener(window, 'pointermove', onMove)
useEventListener(window, 'pointerup', onTouchUp)
useEventListener(window, 'pointercancel', onTouchUp)
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
  window.clearTimeout(releaseTimer)
  running.forEach((r) => r.stop())
})
</script>

<template>
  <div ref="root" class="tarot relative aspect-[7/12]" :class="[`tarot--l${level}`, `tarot--${paquet}`, { 'touch-none': settled && !reduced }]" @click="onCardClick" @pointerdown="onTouchDown">
    <div class="tarot__sr absolute size-px m-[-1px] overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" role="status" aria-live="polite">
      {{ faceUp ? `Carte retournée : ${arcane.nom}.` : '' }}
    </div>
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
                <div class="tarot__emblem [flex:0_0_24cqw] w-[24cqw] [color:var(--tarot-ink)]" :style="{ '--emblem-mask': maskUrl }"><TarotEmblem :symbole="arcane.symbole" /></div>
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
              <div ref="shimmerEl" class="tarot__shimmer absolute inset-0 pointer-events-none opacity-0" />
            </div>
            <!-- Dos : le même visuel que les cartes de DeckCut (TarotCardBack). -->
            <div class="tarot__face tarot__back absolute inset-0" :class="{ 'tarot__face--up': faceUp }" :aria-hidden="faceUp">
              <TarotCardBack fill :paquet="paquet" class="absolute inset-0">
                <div class="tarot__glare absolute inset-0 pointer-events-none [opacity:var(--glare,0)] [transition:opacity_0.2s]" />
              </TarotCardBack>
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
/* Reflet unique à la pose : une bande diagonale douce, animée en JS (WAAPI) sur son propre élément, une seule fois, jamais en mouvement réduit. */
.tarot__shimmer {
  background: linear-gradient(115deg, transparent 35%, rgb(255 250 225 / 0.35) 50%, transparent 65%);
  will-change: transform, opacity;
}
/* Teinte du paquet choisi : l’encre et le papier (discrets) et la teinte du reflet ; le cadre doré reste doré. */
.tarot--feu {
  --tarot-ink: #3a1410;
  --tarot-paper: #f5ddae;
  --foil-hue: -35deg;
}
.tarot--brume {
  --tarot-ink: #0f2b28;
  --tarot-paper: #e8e5bd;
  --foil-hue: 70deg;
}
/* Reflet holographique (CSS seul) sur l’or : cadre, coins, bandeau du numéro et emblème. Chaque pseudo-élément superpose le même dégradé
   (--foil) en color-dodge, découpé aux zones dorées par un masque ; sa position suit --gx/--gy (pointeur ou gyroscope) et son intensité --glare.
   Aucune animation autonome : la luminosité ne change que si l’utilisateur incline ou déplace le pointeur. Aucun effet sur la mise en page
   (éléments absolus, sans débordement du panneau mesuré par fitBody). */
.tarot {
  --foil:
    repeating-linear-gradient(115deg, hsl(330 100% 50%) 0, hsl(45 100% 45%) 7cqw, hsl(130 100% 45%) 14cqw, hsl(200 100% 50%) 21cqw, hsl(270 100% 50%) 28cqw, hsl(330 100% 50%) 35cqw),
    conic-gradient(from 30deg at var(--gx, 50%) var(--gy, 50%), hsl(330 100% 50%), hsl(60 100% 45%), hsl(150 100% 45%), hsl(210 100% 50%), hsl(280 100% 50%), hsl(330 100% 50%));
  --foil-base: 0.18;
  --foil-k: 0.4;
}
.tarot--l2 {
  --foil-k: 0.46;
}
.tarot--l3 {
  --foil-k: 0.52;
}
.tarot--l4 {
  --foil-k: 0.58;
}
.tarot--l5 {
  --foil-k: 0.64;
}
.tarot__content::after,
.tarot__corner::after,
.tarot__numero::after,
.tarot__emblem::after {
  content: '';
  position: absolute;
  pointer-events: none;
  background: var(--foil);
  background-size: 70cqw 70cqw;
  background-position: var(--gx, 50%) var(--gy, 50%);
  filter: hue-rotate(var(--foil-hue, 0deg));
  mix-blend-mode: color-dodge;
  opacity: calc(var(--foil-base) + var(--glare, 0) * var(--foil-k));
  transition: opacity 0.2s;
}
/* Cadre : l’anneau de la bordure seulement (zone de remplissage moins zone de contenu). */
.tarot__content::after {
  inset: -0.6cqw;
  padding: 0.6cqw;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
}
.tarot__corner::after {
  inset: 0;
}
.tarot__numero {
  position: relative;
}
.tarot__numero::after {
  inset: -0.5cqw 0;
  padding: 0.5cqw 0;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
}
.tarot__emblem {
  position: relative;
}
.tarot__emblem::after {
  inset: 0;
  mask: var(--emblem-mask) center / contain no-repeat;
  opacity: calc(var(--foil-base) * 1.5 + var(--glare, 0) * var(--foil-k) * 1.3);
}

@media (prefers-reduced-motion: reduce) {
  .tarot__tilt {
    transition: none;
  }
  /* Reflet statique : pas de suivi du pointeur, intensité moyenne fixe. */
  .tarot {
    --foil-base: 0.4;
  }
  .tarot__content::after,
  .tarot__corner::after,
  .tarot__numero::after,
  .tarot__emblem::after {
    transition: none;
  }
}
</style>
