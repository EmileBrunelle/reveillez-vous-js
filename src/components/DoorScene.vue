<script setup lang="ts">
import { useHaptics } from '@/composables/haptics'
import { computed, onMounted, ref, shallowRef, useId, watch, useTemplateRef } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import type { AnimationOptions } from 'motion-v'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useMotionScope } from '@/composables/useMotionScope'
import { focusQuietly } from '@/composables/focusQuietly'
import type { SceneVariant } from '@/content/scenes'
import { creak, knock, slam, unlock } from '@/audio/sfx'
import { useKnockSchedule } from '@/composables/useKnockSchedule'
import { knockIntensity } from '@/engine/knock'
import type { ParanoiaLevel } from '@/engine/paranoia'
import { judge, rhythmFor, toOffsets, type Gap, type Verdict } from '@/engine/rhythm'
import { nextEntrezLine, nextFailLine } from '@/engine/prophecy'
import { prophecies, tableKey, type TableKey } from '@/content/prophecies'
import { useKeyboardModality } from '@/composables/useKeyboardModality'
import { requestOrientationPermission } from '@/composables/useTilt'
import { safeStorage } from '@/composables/safeStorage'
import { secureRng } from '@/engine/rng'
import { useSessionStore } from '@/stores/session'
import Seer from '~icons/rvj/voyante'
import SparkPool from './SparkPool.vue'
import KnockPattern from './KnockPattern.vue'
import DoorShading from './DoorShading.vue'
import DoorGround from './DoorGround.vue'
import { lookFor } from './doorLook'

const { door, line, level, closing, quick } = defineProps<{ door: SceneVariant; line: string; level: ParanoiaLevel; closing?: boolean; quick?: boolean }>()
const emit = defineEmits<{ open: []; about: []; reset: []; resetLevel: []; impact: [number]; knocked: []; closed: []; listening: [boolean] }>()
// Visite de rappel : un seul toucher ouvre la porte (rituel déjà réussi plus tôt dans la session). Fixé au montage.
const quickMode = quick === true
const reduced = useReducedMotion()
const keyboardMode = useKeyboardModality()
// Le haptique n’est pas du mouvement : pas bloqué par « mouvement réduit ». Les gardes (onglet caché, vibrate absent, limiteur) vivent dans haptics.ts.
const { pulse: haptic } = useHaptics()

const stage = useTemplateRef<HTMLElement>('stage')
const hit = useTemplateRef<HTMLButtonElement>('hit')
const leaf = useTemplateRef<HTMLElement>('leaf')
const shake = useTemplateRef<HTMLElement>('shake')
const shade = useTemplateRef<HTMLElement>('shade')
const glow = useTemplateRef<HTMLElement>('glow')
const spill = useTemplateRef<HTMLElement>('spill')
const seer = useTemplateRef<HTMLElement>('seer')
const dustLayer = useTemplateRef<HTMLElement>('dustLayer')
const strip = useTemplateRef<HTMLElement>('strip')
const handleLayer = useTemplateRef<HTMLElement>('handleLayer')
const ui = useTemplateRef<HTMLElement>('ui')
const sparks = useTemplateRef<InstanceType<typeof SparkPool>>('sparks')
const captionLayer = useTemplateRef<HTMLElement>('captionLayer')
const CAPTIONS = 4

type State = 'idle' | 'opening' | 'gone'
let state: State = 'idle'
const isGone = () => state === 'gone'
// Calendrier des coups (horloge Web Audio) : annulé à `halt()` et à la destruction.
const knocks = useKnockSchedule()
let dustAt = 0
const DUST = 10
const OPEN_DEG = 72
// Ombre du battant entièrement ouvert (opacité du calque sombre) : le côté éclairé s’éteint à mesure qu’il s’éloigne de la lumière.
const SHADE_OPEN = 0.6

// Animations Motion et attentes de la scène : arrêtées par `halt()` ou à la destruction (voir useMotionScope).
const { go, snap, wait, halt: haltMotion } = useMotionScope()
// Silence du joueur pendant la répétition : au bout de 1,2 s, le rythme est jugé.
const silence = useTimeoutFn(() => evaluate(), 1200, { immediate: false })
const halt = () => {
  knocks.cancel()
  silence.stop()
  haltMotion()
}

const dust = (n: number) => {
  const layer = dustLayer.value
  if (!layer || reduced.value) return
  const w = layer.offsetWidth
  Array.from({ length: n }).forEach(() => {
    const el = layer.children[dustAt++ % DUST] as HTMLElement
    const x = w * (0.05 + Math.random() * 0.9)
    // Grains de tailles variées qui se détachent du linteau, dérivent un peu et tombent en accélérant.
    const size = 0.6 + Math.random() * 1.2
    go(
      el,
      { x: [x, x + (Math.random() - 0.5) * 30], y: [0, 50 + Math.random() * 110], scale: [size, size * 0.7], rotate: [0, (Math.random() - 0.5) * 180], opacity: [0.9, 0] },
      { duration: 0.7 + Math.random() * 0.7, ease: [0.4, 0, 1, 1] },
    )
  })
}

// La poignée vit dans un SVG en ligne (composant de variante) : pas de ref de gabarit possible, d’où une requête dans notre propre sous-arbre,
// faite une seule fois après le montage (et non à chaque coup). Elle se lit dans le calque des poignées (non filtré), jamais dans la porte
// filtrée : une poignée qui tourne dans le filtre SVG le ferait recalculer (turbulence + éclairages) à chaque image. Le composant est remonté
// à chaque porte (clé `sceneKey` dans App.vue), donc cette lecture unique reste valable.
const doorHandles = shallowRef<{ knobs: NodeListOf<Element> | null; levers: NodeListOf<Element> | null }>({ knobs: null, levers: null })
/** Chaque poignée bouge selon son mécanisme (doorLook) : les boutons tournent, les béquilles s’abaissent (jamais vers le haut), les barres restent fixes. */
const LEVER_RATIO = 0.7
const turnHandles = (knob: number | number[], options?: AnimationOptions) => {
  const { knobs, levers } = doorHandles.value
  go(knobs, { rotate: knob }, options)
  go(levers, { rotate: Array.isArray(knob) ? knob.map((a) => Math.abs(a) * LEVER_RATIO) : Math.abs(knob) * LEVER_RATIO }, options)
}

/** Bascule la porte sous un coup de la voyante ou du joueur. */
const jitter = (intensity: number) => {
  const el = shake.value
  if (!el || reduced.value) return
  const dir = Math.random() < 0.5 ? -1 : 1
  const amp = 2 + 5 * intensity
  // Le bâti encaisse le coup : décalage latéral, léger roulis autour du seuil et un petit recul (échelle), puis ressort amorti qui oscille.
  snap(el, { x: dir * amp, rotateZ: dir * (0.6 + 1.4 * intensity), scale: 1 - 0.006 * (1 + intensity) })
  go(el, { x: 0, rotateZ: 0, scale: 1 }, { type: 'spring', stiffness: 520, damping: 8.5 })
  turnHandles(25 * dir, { duration: 0 })
  turnHandles(0, { type: 'spring', stiffness: 380, damping: 5 })
  dust(2 + Math.round(intensity * 4))
}

/** Poignée sous la souris : elle s’incline d’un ressort au survol et revient au repos en le quittant (la souris seulement ; le tactile n’a pas de survol). */
const handleHover = (over: boolean, e: PointerEvent) => {
  if (e.pointerType !== 'mouse' || reduced.value || state !== 'idle') return
  turnHandles(over ? 14 : 0, { type: 'spring', stiffness: 260, damping: 11 })
}

/** Coup de la voyante, de l’intérieur : le battant pousse vers nous (charnière + léger zoom), poussière du cadre et filet de lumière sous la porte. */
let lastJolt = 0
const jitterInside = (intensity: number) => {
  const el = leaf.value
  if (!el || reduced.value) return
  // Rafale au retour d’un onglet caché : un seul sursaut, pas une pile d’animations.
  const t = performance.now()
  if (t - lastJolt < 90) return
  lastJolt = t
  snap(el, { rotateY: -(1.5 + 2.5 * intensity), scale: 1.012, x: 0 })
  go(el, { rotateY: 0, scale: 1 }, { type: 'spring', stiffness: 600, damping: 12 })
  dust(2 + Math.round(intensity * 2))
  // Seul changement de luminance : filet mince (≈2 px), delta modeste.
  snap(strip.value, { opacity: 0.55 })
  go(strip.value, { opacity: 0 }, { duration: 0.18, ease: 'easeOut' })
}

const look = computed(() => lookFor(door.id))
const maskStyle = computed(() => ({ maskImage: `url('${door.mask}')`, WebkitMaskImage: `url('${door.mask}')` }))
// Gonds et chant d’après l’emprise réelle du battant (boîte 120 × 190), pas d’après la boîte : le pivot et la tranche suivent la silhouette.
const hingePct = computed(() => (look.value.bounds.hingeX / 120) * 100)
const edgeBox = computed(() => {
  const { edgeX, top, bottom } = look.value.bounds
  return { left: `${(edgeX / 120) * 100}%`, top: `${(top / 190) * 100}%`, height: `${((bottom - top) / 190) * 100}%` }
})

// Lueur au sol : un trapèze qui part DU seuil (pied réel de l’embrasure) et s’évase vers l’avant ; son bord haut épouse l’ouverture (gonds → chant),
// et le clip-path (appliqué après le flou) coupe tout ce qui remonterait derrière le seuil.
const spillStyle = computed(() => {
  const { hingeX, edgeX, bottom } = look.value.bounds
  const w = ((edgeX - hingeX) / 120) * 100
  return { left: `${(hingeX / 120) * 100 - w / 2}%`, width: `${w * 2}%`, top: `${(bottom / 190) * 100}%` }
})

const session = useSessionStore()
const intensity = () => knockIntensity(level)
const playerKnock = (e: MouseEvent, fromPointer = false) => {
  session.pulse(0.6)
  unlock()
  haptic(20)
  knock(intensity())
  jitter(intensity())
  const r = stage.value?.getBoundingClientRect()
  const fromKeyboard = !fromPointer && (e.detail === 0 || (e.clientX === 0 && e.clientY === 0))
  if (fromKeyboard && r) sparks.value?.emit(r.left + r.width / 2, r.top + r.height / 2)
  else sparks.value?.emit(e.clientX, e.clientY)
}

const caption = (i: number) => {
  const layer = captionLayer.value
  const el = layer?.children[i % CAPTIONS] as HTMLElement | undefined
  if (!el) return
  const side = i % 2 ? 1 : -1
  const dx = side * ((stage.value?.offsetWidth ?? 120) * 0.55 + 10)
  if (reduced.value) go(el, { x: dx, y: 0, opacity: [1, 0] }, { duration: 0.5 })
  else go(el, { x: [dx, dx + side * 8], y: [0, -22], scale: [0.6, 1.1], opacity: [1, 0] }, { duration: 0.55, ease: 'easeOut' })
}

type Phase = 'invite' | 'listen' | 'repeat' | 'busy'
const phase = ref<Phase>('invite')
const saidId = useId()
const texts = (key: TableKey) => (Array.isArray(prophecies[key]) ? (prophecies[key] as unknown[]).filter((t): t is string => typeof t === 'string') : [])
const ghosts = computed(() => ['(Cognez à la porte)', line, ...texts(tableKey('rate', level)), ...texts('entrez')])
watch(phase, (p) => emit('listening', p === 'listen'))
const said = ref(quickMode ? line : '(Cognez à la porte)')
const verdictText = ref('')
// Invite sans geste depuis ~3 s : on souffle que la porte se touche (respiration lente + ligne d’aide).
const nudge = ref(false)
// Promotion du cadre en calque pendant l’ouverture seulement : le zoom (1 à 3,6) ne repeint alors ni le cadre filtré ni le sol à chaque image.
const zooming = ref(false)
const nudgeTimer = useTimeoutFn(() => (nudge.value = true), 3000, { immediate: false })
// Retour en douceur de la respiration : on fige l’échelle courante dans une variable CSS, et une courte animation la ramène à 1
// (sans cela, `scale` retomberait d’un coup à 1 dès le premier coup).
const settling = ref(false)
const stopNudge = () => {
  nudgeTimer.stop()
  const el = leaf.value
  if (nudge.value && el && !reduced.value) {
    const current = getComputedStyle(el).scale
    if (current && current !== 'none') {
      el.style.setProperty('--settle', current)
      settling.value = true
    }
  }
  nudge.value = false
}
const hint = computed(() => {
  if (verdictText.value) return verdictText.value
  if (phase.value === 'listen') return 'Ça cogne de l’intérieur…'
  if (phase.value === 'repeat') return 'Touchez la porte : un coup par point.'
  if (phase.value === 'invite' && (nudge.value || quickMode)) return quickMode ? 'Touchez la porte pour l’ouvrir.' : 'Touchez la porte pour cogner.'
  return ''
})
const announce = ref('')
const pattern = ref<Gap[]>([])
const lit = ref(0)
const filled = ref(0)
let fails = 0
let taps: number[] = []
let started = false
let firstListen = true
let retryIntro = ''

const VERDICTS: Record<Exclude<Verdict, 'ok'>, string> = {
  'trop-peu': 'Pas assez de coups.',
  trop: 'Trop de coups.',
  rythme: 'Le bon nombre de coups, mais pas le bon rythme.',
}
const describe = (gaps: Gap[]) => gaps.reduce((acc, g) => acc + (g === 'long' ? ', pause, toc' : ' toc'), 'toc')

const startListen = () => {
  if (state !== 'idle') return
  phase.value = 'listen'
  lit.value = 0
  filled.value = 0
  taps = []
  if (pattern.value.length === 0) pattern.value = rhythmFor(level, secureRng())
  const intro = firstListen ? `${line} — ` : retryIntro
  retryIntro = ''
  if (firstListen) said.value = line
  firstListen = false
  announce.value = `${intro}Ça cogne de l’intérieur : ${describe(pattern.value)}`
  knocks.schedule(toOffsets(pattern.value, level), intensity(), seerHit)
}

const seerHit = (i: number, force: number) => {
  session.pulse(1)
  lit.value = i + 1
  jitterInside(force)
  caption(i)
  haptic(30)
  // Laisse le dernier point allumé un instant avant de passer la main au joueur.
  if (i >= pattern.value.length) {
    void wait(300).then(() => {
      if (state !== 'idle') return
      phase.value = 'repeat'
      announce.value = 'À vous de cogner.'
    })
  }
}

const evaluate = () => {
  silence.stop()
  if (phase.value !== 'repeat') return
  phase.value = 'busy'
  const v = judge(pattern.value, taps)
  if (v === 'ok') {
    verdictText.value = 'Bien.'
    announce.value = 'Bien. La porte s’ouvre.'
    emit('knocked')
    void wait(350).then(open)
    return
  }
  fails++
  const store = safeStorage()
  verdictText.value = VERDICTS[v]
  if (fails >= 3) {
    said.value = nextEntrezLine(prophecies, store, secureRng(), 'Entrez.')
    announce.value = said.value
    void wait(1800).then(open)
    return
  }
  said.value = nextFailLine(prophecies, level, store, secureRng(), 'Pas tout à fait. Écoutez encore.')
  retryIntro = `${VERDICTS[v]} ${said.value} — `
  announce.value = ''
  void wait(1600).then(() => {
    verdictText.value = ''
    startListen()
  })
}

const onDoor = (e: MouseEvent, fromPointer = false) => {
  requestOrientationPermission() // repli iOS : no-op si déjà accordé/refusé
  if (state === 'opening') return finish()
  if (state !== 'idle') return
  if (phase.value === 'invite') {
    stopNudge()
    playerKnock(e, fromPointer)
    // Une seule suite par visite : des touchers rapprochés ne programment pas une deuxième ouverture (qui couperait l’animation, voir open).
    if (!started) {
      started = true
      if (quickMode) {
        // Un seul coup, la porte réagit tout de suite (secousse + étincelles), puis elle s’ouvre.
        announce.value = 'La porte s’ouvre.'
        void wait(450).then(open)
      } else void wait(800).then(startListen)
    }
  } else if (phase.value === 'repeat') {
    taps.push(performance.now())
    filled.value = Math.min(taps.length, pattern.value.length + 1)
    playerKnock(e, fromPointer)
    if (taps.length > pattern.value.length + 1) evaluate()
    else silence.start() // redémarre le délai à chaque coup
  }
}
const onDoorKeydown = (e: KeyboardEvent) => {
  if (e.repeat) e.preventDefault()
}
// Tactile : le coup est mesuré au pointerdown (pas au click, ~0–300 ms plus tard) ; le click qui suit est ignoré.
let pointerKnockAt = -Infinity
const onDoorPointerdown = (e: PointerEvent) => {
  if (e.pointerType === 'mouse') return
  pointerKnockAt = performance.now()
  onDoor(e, true)
}
const onDoorClick = (e: MouseEvent) => {
  if (performance.now() - pointerKnockAt < 1000 && e.detail > 0) return
  onDoor(e)
}
// Évite la sélection de texte par clics multiples.
const onDoorMousedown = (e: MouseEvent) => {
  if (e.detail > 1) e.preventDefault()
}

onMounted(() => {
  const layer = handleLayer.value
  layer?.querySelectorAll<SVGElement>('.door-handle').forEach((el, i) => {
    const kind = look.value.handles[i] ?? 'bar'
    el.dataset.kind = kind
    if (kind === 'lever') el.style.transformOrigin = '0% 50%' // la béquille pivote autour de son axe (extrémité gauche)
  })
  doorHandles.value = { knobs: layer?.querySelectorAll('[data-kind=knob]') ?? null, levers: layer?.querySelectorAll('[data-kind=lever]') ?? null }
  if (closing) return void slamShut()
  go(ui.value, { opacity: [0, 1] }, { duration: 0.3 })
  nudgeTimer.start()
})

const open = async () => {
  if (state === 'opening') return finish()
  if (state !== 'idle') return
  state = 'opening'
  unlock()
  halt()
  snap(shake.value, { x: 0, rotateZ: 0, scale: 1 })
  snap(leaf.value, { rotateY: 0, scale: 1, z: 0 })
  creak()
  if (reduced.value) {
    go(leaf.value, { opacity: 0 }, { duration: 0.2 })
    go(glow.value, { opacity: 1 }, { duration: 0.2 })
    go(seer.value, { opacity: 1 }, { duration: 0.2 })
    await wait(400)
    return finish()
  }
  zooming.value = true
  // La poignée tourne, le battant hésite (un léger tirage vers nous), puis il pivote sur ses gonds ; l’ombre du battant suit l’angle.
  turnHandles([0, 38, 0], { duration: 0.34, ease: 'easeInOut' })
  go(
    leaf.value,
    // Porte à joint (frigo) : le battant se décolle d’abord vers nous (translation Z de `tug` px, comme un joint magnétique qui lâche).
    { rotateY: [0, -2.5, OPEN_DEG], ...(look.value.tug ? { z: [0, look.value.tug, look.value.tug] } : {}) },
    {
      duration: 0.75,
      times: [0, 0.14, 1],
      ease: [
        [0.3, 0, 0.5, 1],
        [0.3, 0, 0.2, 1],
      ],
    },
  )
  go(shade.value, { opacity: [0, SHADE_OPEN] }, { duration: 0.75, ease: [0.3, 0, 0.2, 1] })
  go(glow.value, { opacity: [0, 1] }, { duration: 0.5 })
  go(spill.value, { opacity: [0, 1], scaleX: [0.1, 1], scaleY: [0.2, 1] }, { duration: 0.7, ease: 'easeOut' })
  go(seer.value, { opacity: [0, 1], y: [10, 0], scale: [0.9, 1] }, { duration: 0.4, delay: 0.3 })
  await wait(750)
  if (state !== 'opening') return
  go(ui.value, { opacity: 0 }, { duration: 0.2 })
  // Sortie continue : la caméra traverse la porte (le zoom accélère jusqu’à la fin) et la scène se fond pendant ce même élan, sans arrêt
  // ni coupure. Le zoom (scale) et le fondu (opacity) sont deux propriétés distinctes : aucune animation n’en double une autre.
  go(stage.value, { scale: [1, 3.6] }, { duration: 0.6, ease: [0.55, 0, 1, 0.45] })
  go(stage.value, { opacity: [1, 0] }, { duration: 0.35, delay: 0.25, ease: 'easeIn' })
  await wait(600)
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
  else {
    snap(leaf.value, { rotateY: OPEN_DEG })
    snap(shade.value, { opacity: SHADE_OPEN })
  }
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
  else {
    go(leaf.value, { rotateY: 0 }, { type: 'spring', stiffness: 500, damping: 9 })
    go(shade.value, { opacity: 0 }, { duration: 0.2 })
  }
  await wait(550)
  closed()
}

const closed = () => {
  if (state === 'gone') return
  state = 'gone'
  halt()
  emit('closed')
}

// Focus donné par App après un changement d’écran (sans anneau si la dernière entrée n’était pas au clavier).
defineExpose({ focus: () => focusQuietly(hit.value, { preventScroll: true }) })

const onSceneClick = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button')) return
  if (closing) closed()
  else if (state === 'opening') finish()
}
</script>

<template>
  <section
    class="scene grid-rows-[minmax(0,1fr)_auto] [--stage-cap:clamp(10rem,45dvh,28rem)] max-sm:portrait:[--stage-cap:clamp(10rem,54dvh,30rem)] h-[min(calc(100dvh_-_var(--taskbar-h)_-_0.75rem_-_var(--pad-t)),calc(var(--stage-cap)_+_11rem))]"
    @click="onSceneClick"
  >
    <div
      ref="stage"
      data-stage
      :class="{ 'will-change-transform': zooming }"
      class="relative w-auto h-full max-h-[var(--stage-cap)] self-end aspect-[120/190] origin-[50%_45%] select-none [-webkit-tap-highlight-color:transparent]"
    >
      <div class="absolute inset-0" aria-hidden="true">
        <div
          ref="glow"
          class="absolute inset-[1.5px] opacity-0 [mask-size:100%_100%] [mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [-webkit-mask-repeat:no-repeat] [background:radial-gradient(ellipse_at_50%_60%,#fff6c8_0%,#ffd56a_45%,#7a4a10_100%)]"
          :style="{ maskImage: `url('${door.mask}')`, WebkitMaskImage: `url('${door.mask}')` }"
        />
        <div ref="seer" class="absolute left-1/2 bottom-0 w-[38%] -ml-[19%] opacity-0 [&_.seer]:block [&_.seer]:w-full"><Seer class="seer" /></div>
      </div>
      <div
        ref="spill"
        class="absolute h-[80%] opacity-0 origin-[50%_0] [clip-path:polygon(25%_0,75%_0,100%_100%,0_100%)] [background:linear-gradient(to_bottom,rgb(255_226_140/0.85),rgb(255_226_140/0.45)_30%,rgb(255_226_140/0))] blur-[7px] pointer-events-none"
        :style="spillStyle"
        aria-hidden="true"
      />
      <DoorGround :door-id="door.id" layer="sol" />
      <DoorShading v-if="door.frame" :door-id="door.id" class="absolute inset-0 pointer-events-none"><component :is="door.frame" class="block w-full h-full" /></DoorShading>
      <!-- Trois maîtres de transform distincts, emboîtés : `shake` (vibration du cognement, Motion) > `door-tilt` (inclinaison au survol, CSS)
           > `leaf` (pivot sur les gonds, Motion). La perspective vit sur le parent direct, centrée sur la porte ; la 3D ne sort pas de ce bloc. -->
      <div ref="shake" class="absolute inset-0 origin-[50%_85%]">
        <div class="absolute inset-0 [perspective:1500px] [perspective-origin:50%_50%]">
          <div class="door-tilt absolute inset-0 transform-3d" :style="{ transformOrigin: `${hingePct}% 50%` }">
            <div
              ref="leaf"
              data-leaf
              :data-nudge="nudge && phase === 'invite' ? '' : undefined"
              :data-settle="settling ? '' : undefined"
              class="absolute inset-0 transform-3d will-change-transform select-none [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
              role="img"
              :aria-label="door.label"
              :style="{ transformOrigin: `${hingePct}% 50%` }"
              @animationend="settling = false"
            >
              <div class="absolute inset-0 backface-hidden">
                <!-- Lueur du survol et anneau du focus clavier : calques frères derrière la porte (silhouette pleine dont seul le débord se voit),
                     jamais un `filter` sur le nœud filtré lui-même, qui se re-rastériserait à chaque image de la transition. -->
                <div class="door-halo absolute inset-0 pointer-events-none opacity-0" aria-hidden="true">
                  <div class="absolute inset-0 bg-[rgb(255_226_140)] [mask-size:100%_100%] [mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [-webkit-mask-repeat:no-repeat]" :style="maskStyle" />
                </div>
                <div class="door-ring absolute inset-0 pointer-events-none opacity-0" aria-hidden="true">
                  <div class="absolute inset-0 bg-[var(--accent)] [mask-size:100%_100%] [mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [-webkit-mask-repeat:no-repeat]" :style="maskStyle" />
                </div>
                <!-- Porte filtrée, statique (poignées masquées par CSS) ; les poignées, seules à bouger, sont redessinées au-dessus sans filtre. -->
                <DoorShading class="door-base" :door-id="door.id"><component :is="door.component" class="block w-full h-full" /></DoorShading>
                <div ref="handleLayer" class="door-handles absolute inset-0 pointer-events-none" :style="{ filter: `brightness(${look.gain})` }" aria-hidden="true">
                  <component :is="door.component" class="block w-full h-full" />
                </div>
              </div>
              <!-- Ombre du battant qui s’éloigne de la lumière : simple opacité liée à l’angle, découpée sur la silhouette de la porte. -->
              <div
                ref="shade"
                class="absolute inset-0 bg-[#05060c] opacity-0 pointer-events-none backface-hidden [mask-size:100%_100%] [mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [-webkit-mask-repeat:no-repeat]"
                :style="{ maskImage: `url('${door.mask}')`, WebkitMaskImage: `url('${door.mask}')` }"
              />
              <!-- Chant du côté serrure : une tranche d’environ 3,5 % de la largeur, repliée vers l’arrière, collée au vrai bord du battant (bornes de doorLook). -->
              <div
                class="absolute w-[3.5%] origin-[0_50%] [transform:rotateY(90deg)] pointer-events-none"
                :style="{ ...edgeBox, background: `linear-gradient(to right, ${look.edge}, color-mix(in srgb, ${look.edge} 55%, black))` }"
              />
            </div>
          </div>
        </div>
      </div>
      <DoorGround :door-id="door.id" layer="brume" />
      <div ref="strip" class="absolute left-[8%] right-[8%] -bottom-px h-[2px] opacity-0 bg-[#e8a850] shadow-[0_0_8px_2px_rgb(232_168_80/0.4)] pointer-events-none" aria-hidden="true" />
      <button
        v-if="!closing"
        ref="hit"
        class="door-hit absolute inset-0 z-3 p-0 m-0 border-0 bg-transparent cursor-pointer select-none [touch-action:manipulation] [-webkit-tap-highlight-color:transparent] outline-none"
        type="button"
        aria-label="Cogner à la porte"
        :aria-describedby="saidId"
        :data-phase="phase"
        :data-kbd="keyboardMode"
        @click="onDoorClick"
        @pointerdown="onDoorPointerdown"
        @pointerenter="handleHover(true, $event)"
        @pointerleave="handleHover(false, $event)"
        @keydown="onDoorKeydown"
        @mousedown="onDoorMousedown"
      />
      <div ref="captionLayer" class="absolute left-1/2 top-[18%] h-0 pointer-events-none" aria-hidden="true">
        <span v-for="n in CAPTIONS" :key="n" class="absolute top-0 left-0 -translate-x-1/2 text-[1.3rem] font-bold tracking-[0.1em] text-accent opacity-0">TOC</span>
      </div>
      <div ref="dustLayer" class="absolute inset-x-0 top-0 h-0 pointer-events-none" aria-hidden="true">
        <span v-for="n in 10" :key="n" class="absolute top-0 left-0 w-[3px] h-[3px] bg-[#c9b79a] opacity-0" />
      </div>
    </div>
    <!-- Pendant la fermeture, la zone de texte garde sa place (invisible, inerte) : la porte qui claque reste à la hauteur de la suivante. -->
    <div ref="ui" class="scene scene--ui content-start gap-3 grid-rows-[auto_1.25rem_2.5rem]" :class="{ invisible: closing }" :inert="closing">
      <!-- Phrase + fantômes invisibles (toutes les phrases possibles de la visite) dans la même cellule : la hauteur réservée est celle de la plus longue, la scène ne bouge pas entre les phases. -->
      <div class="grid grid-cols-[minmax(0,1fr)] justify-items-center w-full">
        <p :id="saidId" class="lead max-w-full [text-wrap:balance] [overflow-wrap:anywhere] max-sm:text-[clamp(1.3rem,6vw,1.7rem)] [grid-area:1/1]">{{ said }}</p>
        <span
          v-for="(g, i) in ghosts"
          :key="i"
          class="lead max-w-full [text-wrap:balance] [overflow-wrap:anywhere] max-sm:text-[clamp(1.3rem,6vw,1.7rem)] [grid-area:1/1] invisible pointer-events-none"
          aria-hidden="true"
          >{{ g }}</span
        >
      </div>
      <KnockPattern :class="{ invisible: phase === 'invite' }" :pattern="pattern" :lit="lit" :filled="filled" :mode="phase === 'listen' ? 'listen' : 'repeat'" />
      <p class="m-0 text-[0.9rem]" aria-hidden="true">{{ hint }}</p>
      <p class="sr-only" role="status" aria-live="polite">{{ announce }}</p>
    </div>
    <SparkPool ref="sparks" />
  </section>
</template>

<style scoped>
/* Reste en CSS: .scene (gap > règle globale), ::after décoratif, :has/:deep, paysage. */
.scene {
  gap: 0.75rem;
}
.scene--ui {
  max-width: none;
}
@media (max-height: 30rem) and (orientation: landscape) {
  [data-stage] {
    height: min(var(--stage-cap), calc(100dvh - var(--taskbar-h) - 0.75rem - var(--pad-t)));
  }
}
.door-hit::after {
  content: '';
  position: absolute;
  left: 6%;
  right: 6%;
  bottom: -3px;
  height: 4px;
  background: #e8a850;
  box-shadow: 0 0 0.7778rem 0.2222rem rgb(232 168 80 / 0.45);
  opacity: 0;
  transition: opacity 0.2s;
}
.door-hit[data-kbd='true']:not([data-phase='listen']):focus-visible::after {
  opacity: 0.75;
}
.door-tilt {
  transition: transform 0.25s;
}
/* Poignées : la porte filtrée les cache, le calque des poignées cache tout le reste (la visibilité d’un enfant l’emporte sur celle du parent). */
.door-base :deep(.door-handle) {
  visibility: hidden;
}
.door-handles :deep(svg *) {
  visibility: hidden;
}
.door-handles :deep(.door-handle) {
  visibility: visible;
}
/* Lueur et anneau : calques frères (silhouette découpée par le masque), seule leur opacité change ; le filtre statique ne bouge jamais. */
.door-halo {
  filter: drop-shadow(0 0 0.5556rem rgb(255 226 140 / 0.55));
  transition: opacity 0.25s;
}
/* Focus clavier : anneau qui suit la silhouette de la porte (quatre ombres nettes, une par côté), jamais au clic ni au tap (data-kbd). */
.door-ring {
  filter: drop-shadow(3px 0 0 var(--accent)) drop-shadow(-3px 0 0 var(--accent)) drop-shadow(0 3px 0 var(--accent)) drop-shadow(0 -3px 0 var(--accent));
}
[data-stage]:has(.door-hit[data-kbd='true']:not([data-phase='listen']):focus-visible) .door-tilt {
  transform: rotateY(-5deg);
}
[data-stage]:has(.door-hit[data-kbd='true']:not([data-phase='listen']):focus-visible) .door-halo {
  opacity: 1;
}
[data-stage]:has(.door-hit[data-kbd='true'][data-phase]:focus-visible) .door-ring {
  opacity: 1;
}
/* Survol : seulement avec un vrai pointeur (le :hover collant du tactile laisserait la porte inclinée). */
@media (hover: hover) {
  .door-hit:not([data-phase='listen']):hover::after {
    opacity: 0.75;
  }
  [data-stage]:has(.door-hit:not([data-phase='listen']):hover) .door-tilt {
    transform: rotateY(-5deg);
  }
  [data-stage]:has(.door-hit:not([data-phase='listen']):hover) .door-halo {
    opacity: 1;
  }
}
/* Contraste forcé (Windows High Contrast) : les ombres et lueurs disparaissent, on dessine un vrai contour. */
@media (forced-colors: active) {
  .door-hit[data-kbd='true']:focus-visible {
    outline: 2px solid Highlight;
    outline-offset: -4px;
  }
}
/* Invite : la porte respire (6 s par cycle, ≈0,17 Hz, 1,5 % d’amplitude), sans changement de luminance. Coupée dès le premier coup. */
[data-leaf][data-nudge] {
  animation: door-breathe 6s ease-in-out infinite;
}
/* Fin de l’invite : retour de l’échelle figée (--settle) à 1 en 0,3 s, au lieu d’un saut. */
[data-leaf][data-settle] {
  animation: door-settle 0.3s ease-out;
}
@keyframes door-settle {
  from {
    scale: var(--settle, 1);
  }
}
@keyframes door-breathe {
  /* Propriété `scale` individuelle (et non `transform`) : elle se compose avec les transforms de Motion sur le même élément sans les écraser. */
  50% {
    scale: 1.015;
  }
}
/* Halo de la boule de cristal : respiration lente (5 s, ≈0,2 Hz), faible amplitude, jamais de scintillement. */
[data-stage] :deep(.seer-halo) {
  animation: seer-halo 5s ease-in-out infinite;
}
@keyframes seer-halo {
  50% {
    opacity: 0.4;
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-leaf][data-nudge],
  [data-leaf][data-settle] {
    animation: none;
  }
  [data-stage] :deep(.seer-halo) {
    animation: none;
  }
  .door-tilt,
  .door-halo {
    transition: none;
  }
  [data-stage]:has(.door-hit:not([data-phase='listen']):is(:hover, [data-kbd='true']:focus-visible)) .door-tilt {
    transform: none;
  }
}
@media (max-height: 30rem) and (orientation: landscape) {
  .scene:not(.scene--ui) {
    height: auto;
    grid-template-rows: none;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    column-gap: 1.5rem;
    max-width: 44rem;
  }
}
</style>
