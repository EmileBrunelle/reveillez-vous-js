/* eslint-disable vue/one-component-per-file, vue/require-default-prop -- doublures de composants : plusieurs par fichier, props minimales */
// Doublures légères des composants lourds (GPU, audio, scènes) pour monter App.vue en happy-dom.
// Chaque doublure expose ses événements à travers `ctl` : le test déclenche ce qu’émettrait le vrai composant.
import { defineComponent, h } from 'vue'

// Émetteur d’une doublure, vu de l’extérieur : le test déclenche un événement par son nom.
type Emit = (event: string, ...args: unknown[]) => void
export const ctl = {
  crt: null as null | { emit: Emit; props: Record<string, unknown>; mounts: number },
  door: null as null | { emit: Emit; props: Record<string, unknown>; focus: () => void },
  deck: null as null | { emit: Emit },
  tarot: null as null | { emit: Emit; props: Record<string, unknown> },
  finale: null as null | { emit: Emit },
  activity: null as null | { emit: Emit },
  taskbar: null as null | { emit: Emit; props: Record<string, unknown> },
  windows: {} as Record<string, { props: Record<string, unknown>; emit: Emit } | undefined>,
  bg: null as null | { props: Record<string, unknown> },
  errors: null as null | { props: Record<string, unknown> },
  reset: () => {
    ctl.crt = ctl.door = ctl.deck = ctl.tarot = ctl.finale = ctl.activity = ctl.taskbar = ctl.bg = ctl.errors = null
    ctl.windows = {}
  },
}

export const CrtOverlay = defineComponent({
  props: { paranoia: Number, off: Boolean },
  emits: ['ready', 'fail'],
  setup(props, { emit }) {
    ctl.crt = { emit: emit as Emit, props, mounts: (ctl.crt?.mounts ?? 0) + 1 }
    return () => h('div', { 'data-testid': 'crt' })
  },
})
export const BgPlace = defineComponent({
  props: { place: String, variant: Object, sharp: Boolean },
  setup(props) {
    ctl.bg = { props }
    return () => h('div', { 'data-testid': 'bg', 'data-place': props.place })
  },
})
export const Taskbar = defineComponent({
  props: { level: Number },
  emits: ['about', 'collection', 'sound', 'reset', 'resetLevel'],
  setup(props, { emit }) {
    ctl.taskbar = { emit: emit as Emit, props }
    return () => h('div', { 'data-testid': 'taskbar' })
  },
})
export const FakeErrors = defineComponent({
  props: { level: Number },
  setup(props) {
    ctl.errors = { props }
    return () => h('div', { 'data-testid': 'errors' })
  },
})
export const makeDoor = (focus: () => void) =>
  defineComponent({
    props: { door: Object, line: String, level: Number, closing: Boolean, quick: Boolean },
    emits: ['open', 'about', 'reset', 'resetLevel', 'impact', 'knocked', 'closed', 'listening'],
    setup(props, { emit, expose }) {
      ctl.door = { emit: emit as Emit, props, focus }
      expose({ focus })
      return () => h('div', { 'data-testid': 'door', 'data-closing': String(props.closing), 'data-line': props.line })
    },
  })
export const DeckCut = defineComponent({
  props: { level: Number, rng: Function },
  emits: ['pick'],
  setup(_p, { emit, expose }) {
    ctl.deck = { emit: emit as Emit }
    expose({ focus: () => {} })
    return () => h('div', { 'data-testid': 'deck' })
  },
})
export const TarotCard = defineComponent({
  props: { arcane: Object, title: String, body: String, verse: String, level: Number, paquet: String },
  emits: ['flipped'],
  setup(props, { emit }) {
    ctl.tarot = { emit: emit as Emit, props }
    return () => h('div', { 'data-testid': 'tarot', 'data-body': props.body })
  },
})
export const Finale = defineComponent({
  emits: ['collapsed', 'restart'],
  setup(_p, { emit, expose }) {
    ctl.finale = { emit: emit as Emit }
    expose({ focus: () => {} })
    return () => h('div', { 'data-testid': 'finale' })
  },
})
export const Activity = defineComponent({
  props: { level: Number },
  emits: ['done'],
  setup(_p, { emit }) {
    ctl.activity = { emit: emit as Emit }
    return () => h('div', { 'data-testid': 'activity' })
  },
})
// Fenêtres v-model (À propos, Collection, Son, Réinitialisation) : visibles tant que modelValue est vrai.
export const makeWindow = (name: string) =>
  defineComponent({
    props: { modelValue: Boolean },
    emits: ['update:modelValue', 'confirm'],
    setup(props, { emit }) {
      ctl.windows[name] = { props, emit: emit as Emit }
      return () => h('div', { 'data-testid': `win-${name}`, 'data-open': String(props.modelValue) })
    },
  })

// Le paquet 3D (CardDeck) dépend de Motion (valeurs, ressorts) : décor sans comportement, doublure vide.
export const CardDeck = defineComponent({ setup: () => () => h('div', { 'data-testid': 'card-deck' }) })
