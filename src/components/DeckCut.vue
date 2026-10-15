<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRafFn, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import TarotCardBack from './TarotCardBack.vue'
import { FAN, FAN_SCALE } from './deckFan'
import { cardDeal } from '../audio/sfx'
import { PAQUET_NOMS, shufflePaquets, type Paquet } from '../engine/paquets'
import type { Rng } from '../engine/rng'
import { useReducedMotion } from '../composables/useReducedMotion'

// Coupe du paquet : trois paquets différents (dos, teinte, arcanes) en éventail, dans la même boîte (7:12) que la carte du tirage.
// Tout le mouvement passe par UNE boucle rAF : chaque carte a des valeurs courantes qui poursuivent une cible avec un ressort (aucune transition CSS
// sur transform, rien ne « téléporte »). Au choix, la carte part de sa position courante vers la position et la taille de la carte du tirage,
// où TarotCard prend le relais pixel pour pixel (dos identique, même boîte) : aucun remplacement visible.
const props = defineProps<{ level: number; rng: Rng }>()
const emit = defineEmits<{ pick: [paquet: Paquet] }>()
const reduced = useReducedMotion()

const paquets = shufflePaquets(props.rng)
const deckEl = ref<HTMLElement>()
const slotEls = ref<HTMLElement[]>([])
const tiltEls = ref<HTMLElement[]>([])
const glowEls = ref<HTMLElement[]>([])
const chosen = ref<number | null>(null)
const hot = ref<number | null>(null)
const ready = ref(false)
const cards = [0, 1, 2] as const
const label = computed(() => (hot.value === null ? '' : PAQUET_NOMS[paquets[hot.value]]))

// --- ressorts -------------------------------------------------------------------------------------------------------------------
interface Spr {
  c: number // valeur courante
  v: number // vitesse
  t: number // cible
}
const spr = (c = 0): Spr => ({ c, v: 0, t: c })
const CH = ['x', 'y', 'r', 's', 'tx', 'ty', 'o'] as const
type Ch = (typeof CH)[number]
interface Card extends Record<Ch, Spr> {
  startAt: number
  swayPhase: number
  k: number // raideur de la position/échelle/rotation
  zeta: number // amortissement (< 1 : léger dépassement)
}
const state: Card[] = cards.map((i) => ({ x: spr(), y: spr(), r: spr(), s: spr(FAN_SCALE), tx: spr(), ty: spr(), o: spr(), startAt: 0, swayPhase: i * 2.1, k: 190, zeta: 0.55 }))
const dampOf = (k: number, zeta: number) => 2 * zeta * Math.sqrt(k)
const step = (p: Spr, k: number, d: number, dt: number) => {
  p.v += (k * (p.t - p.c) - d * p.v) * dt
  p.c += p.v * dt
}
// Boîte étroite (téléphone en paysage) : les cartes latérales s’écartent davantage pour garder une bande cliquable d’au moins ~44 px.
const fx = (i: number) => FAN[i].x * (W < 260 ? 1.8 : 1)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

let W = 0 // largeur de la boîte de la carte (px)
useResizeObserver(deckEl, () => {
  W = deckEl.value?.offsetWidth ?? 0
  if (reduced.value) layoutStatic()
})

// Position de repos d’une carte de l’éventail (px dans la boîte), avec l’effet du survol : la carte visée monte et se redresse, les voisines s’écartent.
const restOf = (i: number, h: number | null) => {
  const f = FAN[i]
  const me = h === i
  const sep = h === null || me ? 0 : (i < h ? -1 : 1) * 0.015 * W
  return { x: (fx(i) / 100) * W + sep, y: (f.y / 100) * W + (me ? -0.04 * W : 0), r: me ? f.rot * 0.35 : f.rot, s: me ? FAN_SCALE * 1.04 : FAN_SCALE }
}
const stackOf = (i: number) => ({ x: (i - 1) * 0.006 * W, y: 0.05 * W - i * 0.006 * W, r: (i - 1) * 2, s: FAN_SCALE * 0.92 })

// Pointeur : décalage normalisé (−1..1) par rapport au centre de la carte survolée.
let nx = 0
let ny = 0
const MAX_TILT = 7

// --- boucle ---------------------------------------------------------------------------------------------------------------------
type Phase = 'deal' | 'idle' | 'pick'
let phase: Phase = 'deal'
let pickAt = 0
let lastTs = 0
const FINAL_S = 1 // l’élément a la largeur de la boîte : échelle 1 = la carte du tirage
let startS = FAN_SCALE
const OTHERS_DELAY = 90 // anticipation de la carte choisie (ms) avant la fuite des autres et l’envol
let finished = false

const apply = () => {
  cards.forEach((i) => {
    const c = state[i]
    const slot = slotEls.value[i]
    const tilt = tiltEls.value[i]
    if (!slot || !tilt) return
    slot.style.transform = `translate3d(${c.x.c.toFixed(2)}px, ${c.y.c.toFixed(2)}px, 0) rotate(${c.r.c.toFixed(3)}deg) scale(${c.s.c.toFixed(4)})`
    slot.style.opacity = String(clamp(c.o.c, 0, 1))
    tilt.style.transform = `perspective(${(W * 1.3).toFixed(0)}px) rotateX(${c.tx.c.toFixed(2)}deg) rotateY(${c.ty.c.toFixed(2)}deg)`
    const g = glowEls.value[i]
    if (g && chosen.value === i) {
      const prog = clamp((c.s.c - startS) / (FINAL_S - startS), 0, 1)
      g.style.opacity = String(Math.sin(Math.PI * prog))
    }
  })
}

const finish = () => {
  if (finished || chosen.value === null) return
  finished = true
  const c = state[chosen.value]
  CH.forEach((ch) => {
    c[ch].c = c[ch].t
    c[ch].v = 0
  })
  c.o.c = 1
  glowEls.value[chosen.value]?.style.setProperty('opacity', '0')
  apply()
  emit('pick', paquets[chosen.value])
}

const tick = (now: number) => {
  if (!W) return
  const frame = lastTs ? Math.min((now - lastTs) / 1000, 1 / 30) : 1 / 60
  lastTs = now
  const t = now / 1000
  // Cibles
  cards.forEach((i) => {
    const c = state[i]
    if (phase === 'deal' || phase === 'idle') {
      if (now < c.startAt) return
      const rest = restOf(i, hot.value)
      const isHot = hot.value === i
      // Léger balancement propre à chaque carte (mouvement seulement), calmé sous le pointeur.
      const sway = isHot ? 0 : 1
      c.x.t = rest.x
      c.y.t = rest.y + Math.sin(t * 1.4 + c.swayPhase) * 0.007 * W * sway
      c.r.t = rest.r + Math.sin(t * 0.9 + c.swayPhase * 1.7) * 0.9 * sway
      c.s.t = rest.s
      c.o.t = 1
      // Inclinaison : proportionnelle au décalage du pointeur, plus un peu de la vitesse de la carte (elle « traîne » dans le mouvement).
      const lean = (v: number) => clamp((v / Math.max(W, 1)) * 2.2, -6, 6)
      c.ty.t = (isHot ? nx * MAX_TILT : 0) + lean(c.x.v)
      c.tx.t = (isHot ? -ny * MAX_TILT : 0) - lean(c.y.v)
      c.k = phase === 'deal' ? 190 : 230
      c.zeta = phase === 'deal' ? 0.55 : 0.68
    } else if (chosen.value === i) {
      const rest = restOf(i, null)
      if (now < pickAt + OTHERS_DELAY) {
        // Anticipation : petit recul avant l’envol.
        c.x.t = rest.x
        c.y.t = rest.y + 0.018 * W
        c.r.t = rest.r
        c.s.t = rest.s * 0.94
        c.k = 420
        c.zeta = 0.9
      } else {
        c.x.t = 0
        c.y.t = 0
        c.r.t = 0
        c.s.t = FINAL_S
        c.k = 120
        c.zeta = 0.74
      }
      c.tx.t = 0
      c.ty.t = 0
      c.o.t = 1
    } else {
      const k = i < (chosen.value ?? 0) ? 0 : 1
      const off = pickAt + OTHERS_DELAY + (k + (i === 1 ? 0.5 : 0)) * 70
      if (now >= off) {
        const f = FAN[i]
        const dir = f.x === 0 ? 0 : Math.sign(f.x)
        c.x.t = (fx(i) / 100) * W + dir * 0.5 * W
        c.y.t = (f.y / 100) * W + 0.14 * W
        c.r.t = f.rot * 2.2
        c.o.t = 0
        c.k = 110
        c.zeta = 0.85
      }
      c.tx.t = 0
      c.ty.t = 0
    }
  })
  // Intégration (deux sous-pas : stable même à faible fréquence d’images)
  for (let n = 0; n < 2; n++) {
    cards.forEach((i) => {
      const c = state[i]
      if (now < c.startAt && phase === 'deal') return
      const d = dampOf(c.k, c.zeta)
      step(c.x, c.k, d, frame / 2)
      step(c.y, c.k, d, frame / 2)
      step(c.r, c.k, d, frame / 2)
      step(c.s, c.k, d, frame / 2)
      step(c.tx, 260, dampOf(260, 0.5), frame / 2)
      step(c.ty, 260, dampOf(260, 0.5), frame / 2)
      step(c.o, 160, dampOf(160, 1), frame / 2)
    })
  }
  apply()
  if (phase === 'pick' && chosen.value !== null && now > pickAt + OTHERS_DELAY + 200) {
    const c = state[chosen.value]
    const settled = Math.abs(c.x.c) < 0.4 && Math.abs(c.y.c) < 0.4 && Math.abs(c.r.c) < 0.15 && Math.abs(c.s.c - FINAL_S) < 0.004 && Math.abs(c.x.v) + Math.abs(c.y.v) < 8
    if (settled) finish()
  }
}
const { resume } = useRafFn(({ timestamp }) => tick(timestamp), { immediate: false })

// --- mode « mouvement réduit » : cartes droites, aucun mouvement ; au choix, la carte prend la place de celle du tirage sans trajet ---
const layoutStatic = () => {
  cards.forEach((i) => {
    const f = FAN[i]
    const c = state[i]
    c.x.c = c.x.t = (fx(i) / 100) * W
    c.y.c = c.y.t = (f.y / 100) * W
    c.r.c = c.r.t = 0
    c.s.c = c.s.t = FAN_SCALE
    c.o.c = c.o.t = chosen.value === null || chosen.value === i ? 1 : 0
    if (chosen.value === i) {
      c.x.c = c.y.c = 0
      c.s.c = FINAL_S
    }
  })
  apply()
}
const { start: startReducedPick } = useTimeoutFn(() => emit('pick', paquets[chosen.value ?? 0]), 150, { immediate: false })

// --- entrée ---------------------------------------------------------------------------------------------------------------------
const dealSfx = cards.map((i) => useTimeoutFn(cardDeal, 160 + i * 110, { immediate: false }))
const { start: startPhase } = useTimeoutFn(() => (phase = 'idle'), 900, { immediate: false })
const { start: startReady } = useTimeoutFn(() => (ready.value = true), 1000, { immediate: false })
onMounted(() => {
  W = deckEl.value?.offsetWidth ?? 0
  if (reduced.value) {
    layoutStatic()
    ready.value = true
    return
  }
  const now = performance.now()
  cards.forEach((i) => {
    const c = state[i]
    const st = stackOf(i)
    c.x.c = st.x
    c.y.c = st.y
    c.r.c = st.r
    c.s.c = st.s
    c.o.c = 0
    c.startAt = now + 120 + i * 110
    dealSfx[i].start()
  })
  apply()
  startReady()
  phase = 'deal'
  resume()
  // La phase « deal » devient « idle » (mêmes cibles, ressort un peu plus ferme) quand la dernière carte est posée.
  startPhase()
})

// --- interactions ---------------------------------------------------------------------------------------------------------------
const setHot = (i: number | null) => {
  if (chosen.value !== null || !ready.value || reduced.value) return
  if (i === null || hot.value !== i) {
    nx = 0
    ny = 0
  }
  hot.value = i
}
const labelOnly = (i: number | null) => {
  // Mouvement réduit : seul le nom du paquet s’affiche.
  if (chosen.value === null) hot.value = i
}
const onEnter = (i: number, e: PointerEvent) => (e.pointerType === 'touch' ? undefined : reduced.value ? labelOnly(i) : setHot(i))
const onLeave = (i: number) => (hot.value === i ? (reduced.value ? labelOnly(null) : setHot(null)) : undefined)
const onMove = (i: number, e: PointerEvent) => {
  if (hot.value !== i || e.pointerType === 'touch' || reduced.value || !deckEl.value) return
  const r = deckEl.value.getBoundingClientRect()
  const f = FAN[i]
  const cardW = FAN_SCALE * r.width
  const cx = r.left + r.width / 2 + (fx(i) / 100) * r.width
  const cy = r.top + r.height / 2 + (f.y / 100) * r.width - 0.04 * r.width
  nx = clamp((e.clientX - cx) / (cardW / 2), -1, 1)
  ny = clamp((e.clientY - cy) / ((cardW * 12) / 7 / 2), -1, 1)
}
const onDown = (i: number, e: PointerEvent) => (e.pointerType === 'touch' ? setHot(i) : undefined)
const onFocus = (i: number, e: FocusEvent) => ((e.target as HTMLElement).matches(':focus-visible') ? (reduced.value ? labelOnly(i) : setHot(i)) : undefined)

const { start: startFallback } = useTimeoutFn(() => finish(), 1800, { immediate: false }) // filet indépendant de la boucle rAF (onglet masqué, largeur nulle…)
const choose = (i: number) => {
  if (chosen.value !== null || !ready.value) return
  W = deckEl.value?.offsetWidth ?? W
  chosen.value = i
  hot.value = null
  deckEl.value?.focus() // les boutons se désactivent puis disparaissent : le focus reste dans la coupe au lieu de tomber sur <body>
  if (reduced.value) {
    layoutStatic()
    startReducedPick()
    return
  }
  phase = 'pick'
  pickAt = performance.now()
  startFallback()
  startS = state[i].s.c
}
</script>

<template>
  <!-- La section et la rangée « Fermer la porte » sont dans App.vue (communes à la coupe et à la lecture). -->
  <div ref="deckEl" tabindex="-1" class="deck relative outline-none aspect-[7/12]" role="group" aria-labelledby="deck-prompt">
    <p class="absolute size-px m-[-1px] overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" role="status" aria-live="polite">{{ chosen !== null ? 'Carte choisie.' : '' }}</p>
    <p
      id="deck-prompt"
      class="deck__prompt absolute inset-x-0 top-[12cqw] m-0 font-ui text-[7cqw] leading-[1.1] [color:#f3e3b3] [text-shadow:0.4cqw_0.4cqw_0_#000]"
      :class="{ 'deck__prompt--on': ready && chosen === null }"
    >
      Choisissez une carte.
    </p>
    <p
      class="deck__label absolute inset-x-0 bottom-[6cqw] m-0 font-ui text-[5.2cqw] leading-[1.1] [color:#f3e3b3] [text-shadow:0.4cqw_0.4cqw_0_#000]"
      :class="{ 'deck__label--on': label }"
      aria-hidden="true"
    >
      {{ label }}
    </p>
    <button
      v-for="i in cards"
      :key="i"
      :ref="(el) => (slotEls[i] = el as HTMLElement)"
      type="button"
      style="opacity: 0"
      class="deck__card absolute top-1/2 left-1/2 p-0 m-0 border-0 [background:none] cursor-pointer rounded-[4cqw] will-change-transform focus-visible:[outline:0.9cqw_solid_#f3e3b3] focus-visible:outline-offset-[1.2cqw]"
      :class="{ 'z-10': chosen === i, 'z-5': hot === i && chosen === null, 'pointer-events-none': !ready }"
      :aria-label="PAQUET_NOMS[paquets[i]]"
      :disabled="chosen !== null"
      @click="choose(i)"
      @pointerenter="onEnter(i, $event)"
      @pointerleave="onLeave(i)"
      @pointermove="onMove(i, $event)"
      @pointerdown="onDown(i, $event)"
      @focus="onFocus(i, $event)"
      @blur="onLeave(i)"
    >
      <span :ref="(el) => (glowEls[i] = el as HTMLElement)" class="deck__glow absolute inset-0 rounded-[4cqw] opacity-0 pointer-events-none" aria-hidden="true" />
      <span :ref="(el) => (tiltEls[i] = el as HTMLElement)" class="block relative"><TarotCardBack fill :paquet="paquets[i]" /></span>
    </button>
  </div>
</template>

<style scoped>
/* Même boîte que .tarot (TarotCard) : la largeur d’une carte en cqw, et l’éventail se place par rapport à cette boîte. */
.deck {
  width: min(100cqw, calc(100cqh * 7 / 12));
  container-type: inline-size;
}
.deck__card {
  width: 100cqw; /* échelle de repos = FAN_SCALE, échelle 1 = carte du tirage */
  translate: -50% -50%;
}
/* Seules des opacités passent par CSS : aucun transform n’a de transition (le mouvement est entièrement piloté par la boucle rAF). */
.deck__prompt {
  text-align: center;
  opacity: 0;
  transition: opacity 0.4s ease-out;
}
.deck__prompt--on {
  opacity: 1;
}
.deck__label {
  text-align: center;
  opacity: 0;
  transition: opacity 0.15s ease-out;
}
.deck__label--on {
  opacity: 1;
}
.deck__glow {
  box-shadow: 0 5cqw 9cqw rgb(0 0 0 / 0.75);
}
.deck__card:disabled {
  cursor: default;
}
@media (prefers-reduced-motion: reduce) {
  .deck__prompt,
  .deck__label {
    transition: none;
  }
}
</style>
