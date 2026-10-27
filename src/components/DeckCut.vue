<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useEventListener, useMediaQuery, useRafFn, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import TarotCardBack from './TarotCardBack.vue'
import TarotEmblem from './TarotEmblem.vue'
import { FAN, FAN_SCALE } from './deckFan'
import { isDrag, nearestIndex, tapOutcome } from './deckTouch'
import { cardDeal } from '../audio/sfx'
import { cardHover, cardPick, cardPickStill } from '../audio/cards'
import { PAQUET_NOMS, PAQUET_PRESAGES, shufflePaquets, type Paquet } from '../engine/paquets'
import type { Rng } from '../engine/rng'
import { useReducedMotion } from '../composables/useReducedMotion'
import { focusQuietly } from '../composables/focusQuietly'

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
// Rang d’empilement fixe : passer d’un coup devant une carte qui la recouvre encore donne l’impression de la traverser.
// Au survol, la carte se soulève et ses voisines se tassent ; la carte choisie ne passe devant qu’à l’envol, une fois les autres écartées.
const flying = ref(false)
const restZ = (i: number) => (i === 1 ? 3 : 1)
const zClass = (i: number) => {
  const z = chosen.value === i && flying.value ? 10 : restZ(i)
  return z === 10 ? 'z-10' : z === 3 ? 'z-3' : 'z-1'
}
const ready = ref(false)
const TOUCH_HINT = 'Touchez de nouveau pour choisir.'
const cards = [0, 1, 2] as const
const EMBLEMS: Record<Paquet, string> = { nuit: 'moon', feu: 'flame', brume: 'ghost' }

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
// Grand écran haut (voir la légende, posée à côté) : l’éventail grandit jusqu’à presque la hauteur de la boîte et s’étale davantage ; ses cartes dépassent la largeur de la boîte.
// Mêmes seuils que la mise en page de .deck__side plus bas.
const wide = useMediaQuery('(min-width: 1600px) and (min-height: 1000px) and (min-aspect-ratio: 8/5)')
const fanScale = () => (wide.value ? 0.8 : FAN_SCALE)
const fx = (i: number) => FAN[i].x * (wide.value ? 1.5 : W < 260 ? 1.8 : 1)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

let W = 0 // largeur de la boîte de la carte (px)
useResizeObserver(deckEl, () => {
  W = deckEl.value?.offsetWidth ?? 0
  if (reduced.value) layoutStatic()
})
watch(wide, () => reduced.value && layoutStatic())

// Géométrie de l’emblème du dos (TarotCardBack : disque de 52 % de la largeur de la carte, centré) : sert à calculer de combien les voisines doivent s’écarter.
const EMBLEM_R = 0.52 / 2 // rayon du disque, en fraction de la largeur de la carte
const HOT_LIFT = 0.07 // montée de la carte survolée (fraction de W)
const HOT_SCALE = 1.04
const CLEAR_MARGIN = 0.03 // marge au-delà du bord du disque (couvre aussi l’inclinaison des voisines)
const EDGE = 0.47 // une carte ne dépasse jamais ±0,47 W du centre de la boîte (marge pour la rotation : pas de débordement du viewport)
const EDGE_WIDE = 1 // grand écran : l’éventail déborde la boîte (large d’environ ±0,66 W au repos)
const edge = () => (wide.value ? EDGE_WIDE : EDGE)
// Écart horizontal (fraction de W) d’une voisine i quand la carte h est visée : la carte du milieu libère tout le disque de la carte latérale visée ;
// l’autre carte latérale recule simplement. La carte visée, elle, ne bouge pas horizontalement : le pointeur ne peut pas lui échapper (pas de va-et-vient).
const neighbourShift = (i: number, h: number) => {
  const dir = Math.sign(i - h)
  const half = fanScale() / 2
  const center = fx(i) / 100
  let shift = 0.06
  if (i === 1 && h !== 1) {
    const midNear = center - dir * half // bord de la carte du milieu tourné vers la carte visée
    const embNear = fx(h) / 100 + dir * EMBLEM_R * fanScale() * HOT_SCALE // bord du disque tourné vers la carte du milieu
    shift = Math.max(shift, dir * (embNear - midNear) + CLEAR_MARGIN)
  }
  const target = clamp(center + dir * shift, -(edge() - half), edge() - half)
  return target - center
}

// Position de repos d’une carte de l’éventail (px dans la boîte), avec l’effet du survol : la carte visée monte et se redresse, les voisines s’écartent.
const restOf = (i: number, h: number | null) => {
  const f = FAN[i]
  const me = h === i
  const away = h === null || me ? 0 : Math.sign(i - h)
  const sep = away === 0 ? 0 : neighbourShift(i, h as number) * W
  return {
    x: (fx(i) / 100) * W + sep,
    y: (f.y / 100) * W + (me ? -HOT_LIFT * W : 0),
    r: me ? f.rot * 0.35 : f.rot + away * 2,
    s: me ? fanScale() * HOT_SCALE : fanScale(),
  }
}
const stackOf = (i: number) => ({ x: (i - 1) * 0.006 * W, y: 0.05 * W - i * 0.006 * W, r: (i - 1) * 2, s: fanScale() * 0.92 })

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
let startS = fanScale()
const OTHERS_DELAY = 90 // anticipation de la carte choisie (ms) avant la fuite des autres
const FLY_DELAY = 400 // l’envol de la carte choisie attend que les autres se soient écartées et fondues : elle ne croise jamais une autre carte
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
  flying.value = true
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
      if (now < pickAt + FLY_DELAY) {
        // Anticipation : petit recul pendant que les autres cartes s’écartent, puis l’envol.
        c.x.t = rest.x
        c.y.t = rest.y + 0.018 * W
        c.r.t = rest.r
        c.s.t = rest.s * 0.94
        c.k = 420
        c.zeta = 0.9
      } else {
        flying.value = true
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
        // La carte du milieu s’écarte du côté opposé au choix : elle libère le chemin de l’envol au lieu de rester dessous.
        const dir = f.x === 0 ? (chosen.value === 0 ? 1 : -1) : Math.sign(f.x)
        c.x.t = (fx(i) / 100) * W + dir * 0.5 * W
        c.y.t = (f.y / 100) * W + 0.14 * W
        c.r.t = f.rot * 2.2
        c.o.t = 0
        c.k = 170
        c.zeta = 0.9
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
  if (phase === 'pick' && chosen.value !== null && now > pickAt + FLY_DELAY + 200) {
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
    c.x.c = c.x.t = restOf(i, chosen.value === null ? hot.value : null).x
    c.y.c = c.y.t = (f.y / 100) * W
    c.r.c = c.r.t = 0
    c.s.c = c.s.t = fanScale()
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
  // Mouvement réduit : la description de la carte active est mise en valeur, sans mouvement.
  if (chosen.value === null) {
    hot.value = i
    layoutStatic() // pas d’animation : les voisines se déplacent d’un coup pour découvrir l’emblème
  }
}
const onEnter = (i: number, e: PointerEvent) => {
  if (e.pointerType === 'touch') return
  if (reduced.value) return labelOnly(i)
  if (ready.value && chosen.value === null && hot.value !== i) cardHover() // pas de mouvement en mouvement réduit : pas de frôlement
  setHot(i)
}
const onLeave = (i: number, e?: PointerEvent) => (e?.pointerType === 'touch' ? undefined : hot.value === i ? (reduced.value ? labelOnly(null) : setHot(null)) : undefined)
const onMove = (i: number, e: PointerEvent) => {
  if (hot.value !== i || e.pointerType === 'touch' || reduced.value || !deckEl.value) return
  const r = deckEl.value.getBoundingClientRect()
  const f = FAN[i]
  const cardW = fanScale() * r.width
  const cx = r.left + r.width / 2 + (fx(i) / 100) * r.width
  const cy = r.top + r.height / 2 + (f.y / 100) * r.width - HOT_LIFT * r.width
  nx = clamp((e.clientX - cx) / (cardW / 2), -1, 1)
  ny = clamp((e.clientY - cy) / ((cardW * 12) / 7 / 2), -1, 1)
}
// Toucher : un premier tap (ou un glissement) met un paquet en aperçu, un second tap sur ce paquet le choisit ; un tap hors des cartes annule l’aperçu.
// La carte visée est la plus proche du point de contact en X (pas l’élément du dessus). Le `click` synthétisé du toucher est ignoré (voir onClick).
const coarse = useMediaQuery('(pointer: coarse)')
const touchUsed = ref(false)
const preview = (i: number | null) => {
  if (i !== null && hot.value !== i && !reduced.value) cardHover()
  if (reduced.value) labelOnly(i)
  else setHot(i)
}
interface Touch {
  id: number
  x: number
  y: number
  drag: boolean
}
let touch: Touch | null = null
const nearestCard = (px: number) => {
  const r = deckEl.value?.getBoundingClientRect()
  if (!r) return 0
  return nearestIndex(
    px,
    cards.map((i) => r.left + r.width / 2 + (fx(i) / 100) * r.width),
  )
}
useEventListener(window, 'pointerdown', (e: PointerEvent) => {
  if (e.pointerType !== 'touch') return
  touchUsed.value = true
  if (!ready.value || chosen.value !== null || touch) return
  const onCard = e.target instanceof Element && !!e.target.closest('.deck__card') && !!deckEl.value?.contains(e.target)
  if (!onCard) {
    if (hot.value !== null) preview(null)
    return
  }
  touch = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false }
})
useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!touch || e.pointerId !== touch.id || chosen.value !== null) return
  if (!touch.drag && isDrag(e.clientX - touch.x, e.clientY - touch.y)) touch.drag = true
  if (touch.drag) preview(nearestCard(e.clientX))
})
useEventListener(window, 'pointerup', (e: PointerEvent) => {
  if (!touch || e.pointerId !== touch.id) return
  const t = touch
  touch = null
  if (t.drag || chosen.value !== null) return // après un glissement, l’aperçu reste ; il faudra un tap
  const i = nearestCard(t.x)
  if (tapOutcome(hot.value, i) === 'choose') choose(i)
  else preview(i)
})
useEventListener(window, 'pointercancel', (e: PointerEvent) => {
  if (touch && e.pointerId === touch.id) touch = null
})
const onClick = (i: number, e: MouseEvent) => ((e as PointerEvent).pointerType === 'touch' ? undefined : choose(i))

// Annonce aux lecteurs d’écran : la légende visible est aria-hidden, l’aperçu tactile (et sa consigne) passe donc ici, une seule fois.
const status = computed(() => {
  if (chosen.value !== null) return 'Carte choisie.'
  if (touchUsed.value && hot.value !== null) return `${PAQUET_NOMS[paquets[hot.value]]} : ${PAQUET_PRESAGES[paquets[hot.value]]} ${TOUCH_HINT}`
  return ''
})
const onFocus = (i: number, e: FocusEvent) => ((e.target as HTMLElement).matches(':focus-visible') ? (reduced.value ? labelOnly(i) : setHot(i)) : undefined)

const { start: startFallback } = useTimeoutFn(() => finish(), 1800, { immediate: false }) // filet indépendant de la boucle rAF (onglet masqué, largeur nulle…)
const choose = (i: number) => {
  if (chosen.value !== null || !ready.value) return
  W = deckEl.value?.offsetWidth ?? W
  flying.value = reduced.value
  chosen.value = i
  hot.value = null
  if (reduced.value) cardPickStill()
  else cardPick()
  focusQuietly(deckEl.value) // les boutons se désactivent puis disparaissent : le focus reste dans la coupe au lieu de tomber sur <body>
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
    <p class="absolute size-px m-[-1px] overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" role="status" aria-live="polite">{{ status }}</p>
    <!-- Invite et légende : sans effet de mise en page sauf sur grand écran haut, où elles forment une colonne à droite de l’éventail. -->
    <div class="deck__side">
      <p
        id="deck-prompt"
        class="deck__prompt absolute inset-x-0 top-[12cqw] m-0 font-ui text-[7cqw] leading-[1.1] [color:#f3e3b3] [text-shadow:0.4cqw_0.4cqw_0_#000]"
        :class="{ 'deck__prompt--on': ready && chosen === null }"
      >
        Choisissez une carte.
      </p>
      <!-- Légende unique sous l’éventail : une ligne par paquet, dans l’ordre des cartes ; la ligne de la carte survolée ou ciblée au clavier passe en pleine opacité. -->
      <ul
        class="deck__legend absolute inset-x-[4cqw] bottom-[4cqw] m-0 p-0 list-none flex flex-col gap-[1.2cqw] font-ui text-[4.4cqw] leading-[1.1] text-left [color:#f3e3b3] [text-shadow:0.4cqw_0.4cqw_0_#000,0_0_1.5cqw_#000]"
        :class="{ 'deck__legend--gone': chosen !== null }"
        aria-hidden="true"
      >
        <li v-for="i in cards" :key="i" class="deck__line flex items-start gap-[2cqw]" :class="{ 'deck__line--on': hot === i, 'deck__line--dim': hot !== null && hot !== i }">
          <span class="block shrink-0 size-[5.5cqw] [color:#b9821a]" aria-hidden="true"><TarotEmblem :symbole="EMBLEMS[paquets[i]]" /></span>
          <span
            ><b class="font-normal uppercase">{{ PAQUET_NOMS[paquets[i]] }}</b> : {{ PAQUET_PRESAGES[paquets[i]] }}</span
          >
        </li>
      </ul>
      <!-- Consigne tactile, sous la légende : visible seulement pendant un aperçu (annoncée par la zone de statut, donc aria-hidden ici). -->
      <p
        v-if="coarse"
        class="deck__hint absolute inset-x-[4cqw] bottom-[-6cqw] m-0 font-ui text-[4.2cqw] leading-[1.1] text-left [color:#f3e3b3] [text-shadow:0.4cqw_0.4cqw_0_#000]"
        :class="{ 'deck__hint--on': touchUsed && hot !== null && chosen === null }"
        aria-hidden="true"
      >
        {{ TOUCH_HINT }}
      </p>
    </div>
    <button
      v-for="i in cards"
      :key="i"
      :ref="(el) => (slotEls[i] = el as HTMLElement)"
      type="button"
      style="opacity: 0"
      class="deck__card absolute top-1/2 left-1/2 p-0 m-0 border-0 [background:none] cursor-pointer rounded-[4cqw] will-change-transform focus-visible:[outline:0.9cqw_solid_#f3e3b3] focus-visible:outline-offset-[1.2cqw]"
      :class="[zClass(i), { 'pointer-events-none': !ready }]"
      :aria-label="`${PAQUET_NOMS[paquets[i]]} : ${PAQUET_PRESAGES[paquets[i]]}`"
      :disabled="chosen !== null"
      @click="onClick(i, $event)"
      @pointerenter="onEnter(i, $event)"
      @pointerleave="onLeave(i, $event)"
      @pointermove="onMove(i, $event)"
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
  touch-action: pan-y; /* un glissement horizontal fait suivre l’aperçu au doigt ; le défilement vertical reste au navigateur */
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
.deck__legend,
.deck__line {
  transition: opacity 0.15s ease-out;
}
.deck__line--on {
  color: #fff3c8;
}
/* Paquets non ciblés : un ton plus sourd (et non une opacité basse, qui laisse passer la brume du décor) ; le voile du .deck__legend garantit le contraste. */
.deck__line--dim {
  color: #c2b189;
}
.deck__line--dim > span:first-child {
  opacity: 0.6;
}
/* Voile décoratif : fond sombre estompé derrière la légende, hors flux (aucun effet sur la mise en page), pour que le texte reste lisible sur la brume ou la neige. */
.deck__legend {
  isolation: isolate;
}
.deck__legend::before {
  content: '';
  position: absolute;
  inset: -5cqw;
  z-index: -1;
  border-radius: 6cqw;
  background: rgb(10 5 14 / 0.82);
  filter: blur(2.5cqw);
  pointer-events: none;
}
.deck__hint {
  opacity: 0;
  transition: opacity 0.15s ease-out;
}
.deck__hint--on {
  opacity: 1;
}
.deck__legend--gone {
  opacity: 0;
  transition-duration: 0.2s;
}
.deck__glow {
  box-shadow: 0 5cqw 9cqw rgb(0 0 0 / 0.75);
}
.deck__card:disabled {
  cursor: default;
}
/* Grand écran haut : l’éventail prend toute la hauteur de la boîte, l’invite et la légende passent à sa droite, centrées verticalement (seuils = `wide` du script). */
.deck__side {
  display: contents;
}
@media (min-width: 1600px) and (min-height: 1000px) and (min-aspect-ratio: 8/5) {
  .deck .deck__side {
    display: flex;
    flex-direction: column;
    gap: 3.5cqw;
    position: absolute;
    top: 50%;
    left: calc(50% + 86cqw);
    translate: 0 -50%;
    width: 66cqw;
    text-align: left;
  }
  .deck .deck__prompt {
    font-size: 4.8cqw;
  }
  .deck .deck__prompt,
  .deck .deck__hint,
  .deck .deck__legend {
    position: relative; /* le voile de la légende s’y ancre ; inset auto = aucun décalage */
    inset: auto;
    text-align: left;
  }
}
@media (prefers-reduced-motion: reduce) {
  .deck__prompt,
  .deck__legend,
  .deck__hint,
  .deck__line {
    transition: none;
  }
}
</style>
