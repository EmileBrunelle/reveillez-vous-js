// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- doublures de composants : plusieurs par fichier, props minimales */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { animate } from 'motion-v'
import { ctl } from './stubs'

const focusDoor = vi.hoisted(() => vi.fn())
vi.mock('@/audio/sfx', () => ({ hymn: vi.fn(), unlock: vi.fn(), muted: { value: false } }))
vi.mock('@/components/CrtOverlay.vue', async () => ({ default: (await import('./stubs')).CrtOverlay }))
vi.mock('@/components/backgrounds/BgPlace.vue', async () => ({ default: (await import('./stubs')).BgPlace }))
vi.mock('@/components/Taskbar.vue', async () => ({ default: (await import('./stubs')).Taskbar }))
vi.mock('@/components/CardDeck.vue', async () => ({ default: (await import('./stubs')).CardDeck }))
vi.mock('@/components/FakeErrors.vue', async () => ({ default: (await import('./stubs')).FakeErrors }))
// Motion simulé par des enveloppes transparentes : les vraies animations (WAAPI) ne tournent pas sous happy-dom et rejettent à l’annulation.
vi.mock('motion-v', async () => {
  const { defineComponent, h } = await import('vue')
  const pass = defineComponent({
    inheritAttrs: false,
    props: ['features', 'reducedMotion', 'mode'],
    setup:
      (_p, { slots }) =>
      () =>
        slots.default?.(),
  })
  const box = defineComponent({
    props: ['initial', 'animate', 'exit', 'transition'],
    setup:
      (_p, { slots, attrs }) =>
      () =>
        h('div', attrs, slots.default?.()),
  })
  return { AnimatePresence: pass, LazyMotion: pass, MotionConfig: pass, M: box, domAnimation: {}, animate: vi.fn() }
})
vi.mock('@/lazy', async () => {
  const s = await import('./stubs')
  // Comme un vrai `import()` : objet module (Symbol.toStringTag = 'Module'), que defineAsyncComponent déballe.
  const mod = (c: unknown) => () => Promise.resolve({ default: c, [Symbol.toStringTag]: 'Module' })
  return {
    loadDoorScene: mod(s.makeDoor(focusDoor)),
    loadTarotCard: mod(s.TarotCard),
    loadDeckCut: mod(s.DeckCut),
    loadFinale: mod(s.Finale),
    loadAbout: mod(s.makeWindow('about')),
    loadCollection: mod(s.makeWindow('collection')),
    loadSound: mod(s.makeWindow('sound')),
    loadReset: mod(s.makeWindow('reset')),
    activityFor: (id: string | null) => (id ? mod(s.Activity) : null),
    prefetch: vi.fn(),
  }
})

import App from '@/App.vue'
import { useCollectionStore } from '@/stores/collection'
import { useProgressStore } from '@/stores/progress'
import { WAKE_LABEL } from '@/content/finale'
import { ACTIVITY_PROMPTS } from '@/content/activityPrompts'

const stubMedia = (reduced: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduced && q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {} }))
const emit = (c: { emit: (e: string, ...a: unknown[]) => void } | null | undefined, ev: string, ...args: unknown[]) => c!.emit(ev, ...args)
const open = async (visits = 0, { activated = true, reduced = false } = {}) => {
  setActivePinia(createPinia())
  useProgressStore().visits = visits
  if (activated) Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: true }, configurable: true })
  stubMedia(reduced)
  const w = mount(App, { attachTo: document.body, global: { plugins: [createPinia()] } })
  setActivePinia(w.vm.$pinia)
  return w
}
// L’écran passe de « Connexion » au jeu quand la surcouche CRT annonce `ready` ; la porte se charge ensuite (chunk paresseux).
const ready = async () => {
  emit(ctl.crt, 'ready')
  await flushPromises()
  await vi.waitFor(() => expect(ctl.door).not.toBeNull())
}

const warn = vi.spyOn(console, 'warn')
beforeEach(() => {
  ctl.reset()
  focusDoor.mockClear()
  warn.mockClear()
  sessionStorage.clear()
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  delete (navigator as { userActivation?: unknown }).userActivation
  document.body.innerHTML = ''
  expect(warn).not.toHaveBeenCalled() // zéro avertissement Vue
})

describe('App : porte WebGPU', () => {
  it('au départ : état « Connexion » (CRT monté, aucun jeu, aucune barre des tâches)', async () => {
    vi.useFakeTimers()
    const w = await open()
    expect(w.find('[data-testid=crt]').exists()).toBe(true)
    expect(w.find('[data-testid=taskbar]').exists()).toBe(false)
    expect(w.find('[data-testid=bg]').exists()).toBe(false)
    expect(w.find('[role=status]').text()).toBe('') // région live montée vide…
    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(w.find('[role=status]').text()).toBe('Connexion aux ondes…') // …puis remplie
    w.unmount()
  })

  it('CRT en échec : l’écran « WebGPU requis » remplace tout, sans le jeu', async () => {
    const w = await open()
    emit(ctl.crt, 'fail')
    await flushPromises()
    expect(w.find('[role=alert]').text()).toContain('Les ondes divines exigent WebGPU')
    expect(w.find('[data-testid=crt]').exists()).toBe(false)
    expect(w.find('[data-testid=taskbar]').exists()).toBe(false)
    w.unmount()
  })

  it('« Réessayer » relance une surcouche CRT neuve', async () => {
    const w = await open()
    emit(ctl.crt, 'fail')
    await flushPromises()
    const before = ctl.crt!.mounts
    await w.find('button.btn').trigger('click')
    await flushPromises()
    expect(w.find('[role=alert]').exists()).toBe(false)
    expect(w.find('[data-testid=crt]').exists()).toBe(true)
    expect(ctl.crt!.mounts).toBe(before + 1)
    w.unmount()
  })

  it('« À propos » depuis l’écran de blocage ouvre la fenêtre', async () => {
    const w = await open()
    emit(ctl.crt, 'fail')
    await flushPromises()
    expect(w.find('[data-testid=win-about]').exists()).toBe(false) // chargée à la première ouverture seulement
    await w.find('button.linklike').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(w.find('[data-testid=win-about]').attributes('data-open')).toBe('true'))
    w.unmount()
  })

  it('le jeu apparaît quand le GPU est prêt : fond du lieu, barre des tâches, porte', async () => {
    const w = await open()
    await ready()
    expect(w.find('[data-testid=bg]').exists()).toBe(true)
    expect(w.find('[data-testid=taskbar]').exists()).toBe(true)
    expect(w.find('[data-testid=door]').exists()).toBe(true)
    expect(w.find('[role=status]').classes()).toContain('sr-only')
    expect(ctl.taskbar!.props.level).toBe(1)
    w.unmount()
  })

  it('un `ready` tardif (déjà « ok ») ne rejoue pas l’allumage', async () => {
    const w = await open(0)
    await ready()
    const veil = () => w.find('div.bg-black[aria-hidden=true]')
    expect(veil().exists()).toBe(true)
    await veil().trigger('animationend')
    emit(ctl.crt, 'ready')
    await flushPromises()
    expect(veil().exists()).toBe(false) // un second `ready` ne rallume pas le voile
    w.unmount()
  })
})

describe('App : allumage du moniteur (voile de chauffe)', () => {
  const veil = (w: VueWrapper) => w.find('div.bg-black[aria-hidden=true]')

  it('mouvement normal : un voile noir couvre l’écran, retiré à animationend', async () => {
    const w = await open(0)
    await ready()
    expect(veil(w).exists()).toBe(true)
    await veil(w).trigger('animationend')
    expect(veil(w).exists()).toBe(false)
    w.unmount()
  })

  it('le minuteur de repli (1,4 s) retire le voile si animationend ne vient pas', async () => {
    vi.useFakeTimers()
    const w = await open(0)
    emit(ctl.crt, 'ready')
    await flushPromises()
    expect(veil(w).exists()).toBe(true)
    vi.advanceTimersByTime(1399)
    await flushPromises()
    expect(veil(w).exists()).toBe(true)
    vi.advanceTimersByTime(2)
    await flushPromises()
    expect(veil(w).exists()).toBe(false)
    w.unmount()
  })

  it('mouvement réduit : aucun voile', async () => {
    const w = await open(0, { reduced: true })
    emit(ctl.crt, 'ready')
    await flushPromises()
    expect(veil(w).exists()).toBe(false)
    w.unmount()
  })
})

describe('App : « Approchez-vous »', () => {
  it('sans geste préalable : un bouton plein écran précède la porte, qui n’apparaît qu’après le clic', async () => {
    const w = await open(0, { activated: false })
    emit(ctl.crt, 'ready')
    await flushPromises()
    const btn = w.find('button.absolute.inset-0')
    expect(btn.text()).toBe('Approchez-vous de la porte')
    expect(w.find('[data-testid=door]').exists()).toBe(false)
    await btn.trigger('click')
    await vi.waitFor(() => expect(w.find('[data-testid=door]').exists()).toBe(true))
    expect(w.find('button.absolute.inset-0').exists()).toBe(false)
    w.unmount()
  })
})

describe('App : déroulement d’une visite', () => {
  it('la porte reçoit le focus à l’arrivée ; ses événements remontent (impact, écoute, coups)', async () => {
    const w = await open()
    await ready()
    await vi.waitFor(() => expect(focusDoor).toHaveBeenCalled())
    emit(ctl.door, 'listening', true)
    await flushPromises()
    expect(w.find('div.bg-\\[rgb\\(120_0_0\\/0\\.35\\)\\]').classes()).toContain('opacity-100')
    emit(ctl.door, 'listening', false)
    await flushPromises()
    expect(w.find('div.bg-\\[rgb\\(120_0_0\\/0\\.35\\)\\]').classes()).toContain('opacity-0')
    emit(ctl.door, 'knocked')
    expect(useProgressStore().knocked).toBe(true)
    vi.mocked(animate).mockClear()
    emit(ctl.door, 'impact', 1)
    // l’impact secoue la fenêtre de jeu : une animation x/y/rotate d’amplitude 10 px (amp = 1)
    expect(animate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ x: [0, -10, 8, -5, 3, 0], rotate: expect.any(Array) }), expect.anything())
    w.unmount()
  })

  it('niveau 1 : porte → coupe → lecture → « Fermer la porte » → nouvelle porte (visite comptée)', async () => {
    const w = await open(0)
    await ready()
    emit(ctl.door, 'open')
    await vi.waitFor(() => expect(w.find('[data-testid=deck]').exists()).toBe(true))
    expect(w.find('[data-testid=door]').exists()).toBe(false)
    emit(ctl.deck, 'pick', 'nuit')
    await vi.waitFor(() => expect(w.find('[data-testid=tarot]').exists()).toBe(true))
    expect(ctl.tarot!.props.body).toBeTruthy()
    emit(ctl.tarot, 'flipped')
    await flushPromises()
    const close = w.findAll('button').find((b) => b.text() === 'Fermer la porte')!
    expect(close.exists()).toBe(true)
    expect(close.attributes('disabled')).toBeUndefined()
    await close.trigger('click')
    await vi.waitFor(() => expect(w.find('[data-testid=door]').exists()).toBe(true))
    expect(ctl.door!.props.closing).toBe(true)
    expect(useProgressStore().visits).toBe(1)
    emit(ctl.door, 'closed')
    await flushPromises()
    expect(ctl.door!.props.closing).toBe(false)
    w.unmount()
  })

  it('niveau 2 : une activité s’intercale, puis la coupe', async () => {
    const w = await open(2)
    await ready()
    emit(ctl.door, 'open')
    await vi.waitFor(() => expect(w.find('[data-testid=activity]').exists()).toBe(true))
    expect(w.find('[role=group]').attributes('aria-label')).toBe(ACTIVITY_PROMPTS.wisps.verb) // libellé de l’activité (verbe), pas « Activité »
    emit(ctl.activity, 'done')
    await vi.waitFor(() => expect(w.find('[data-testid=deck]').exists()).toBe(true))
    w.unmount()
  })

  it('la dernière visite du niveau 5 : le bouton s’appelle « Réveillez-vous » et mène à la finale', async () => {
    const w = await open(8)
    await ready()
    emit(ctl.door, 'open')
    await vi.waitFor(() => expect(w.find('[data-testid=activity]').exists()).toBe(true))
    emit(ctl.activity, 'done')
    await vi.waitFor(() => expect(w.find('[data-testid=deck]').exists()).toBe(true))
    emit(ctl.deck, 'pick', 'nuit')
    await vi.waitFor(() => expect(w.find('[data-testid=tarot]').exists()).toBe(true))
    const close = w.findAll('button').find((b) => b.text() === WAKE_LABEL)!
    expect(close).toBeTruthy()
    await close.trigger('click')
    await vi.waitFor(() => expect(w.find('[data-testid=finale]').exists()).toBe(true))
    emit(ctl.finale, 'collapsed')
    await flushPromises()
    expect(ctl.crt!.props.off).toBe(true) // la télé s’éteint
    expect(ctl.bg!.props.sharp).toBe(true)
    emit(ctl.finale, 'restart')
    await vi.waitFor(() => expect(w.find('[data-testid=door]').exists()).toBe(true))
    expect(useProgressStore().visits).toBe(0)
    w.unmount()
  })

  it('le CRT reçoit la paranoïa du niveau', async () => {
    const w = await open(3) // niveau 3 : (3 - 1) / 4
    expect(ctl.crt!.props.paranoia).toBe(0.5)
    w.unmount()
  })

  it('le titre de l’onglet caché devient une réplique ; il redevient normal au retour', async () => {
    let state = 'visible'
    Object.defineProperty(document, 'visibilityState', { get: () => state, configurable: true })
    const w = await open(2)
    state = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(document.title).not.toBe('Réveillez-vous.js')
    state = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(document.title).toBe('Réveillez-vous.js')
    w.unmount()
  })
})

describe('App : fenêtres et barre des tâches', () => {
  it('« Collection », « Son » et « À propos » s’ouvrent à la demande (chargées à la première ouverture)', async () => {
    const w = await open()
    await ready()
    for (const [ev, name] of [
      ['collection', 'collection'],
      ['sound', 'sound'],
      ['about', 'about'],
    ] as const) {
      expect(w.find(`[data-testid=win-${name}]`).exists()).toBe(false)
      emit(ctl.taskbar, ev)
      await vi.waitFor(() => expect(w.find(`[data-testid=win-${name}]`).attributes('data-open')).toBe('true'))
    }
    // La fenêtre se ferme par v-model.
    emit(ctl.windows.sound, 'update:modelValue', false)
    await flushPromises()
    expect(w.find('[data-testid=win-sound]').attributes('data-open')).toBe('false')
    w.unmount()
  })

  it('« À propos » aussi depuis la porte', async () => {
    const w = await open()
    await ready()
    emit(ctl.door, 'about')
    await vi.waitFor(() => expect(w.find('[data-testid=win-about]').attributes('data-open')).toBe('true'))
    w.unmount()
  })

  it('« Oublier » : confirmer efface la collection et remet le niveau à zéro', async () => {
    const w = await open(3)
    await ready()
    const collection = useCollectionStore()
    collection.record('La Tour foudroyée')
    expect(collection.seen.has('La Tour foudroyée')).toBe(true)
    emit(ctl.taskbar, 'reset') // ouvre la confirmation
    await vi.waitFor(() => expect(w.find('[data-testid=win-reset]').attributes('data-open')).toBe('true'))
    emit(ctl.windows.reset, 'confirm')
    await flushPromises()
    expect(collection.seen.size).toBe(0)
    expect(useProgressStore().visits).toBe(0)
    w.unmount()
  })

  it('« Recommencer à zéro » (menu ou porte) remet le niveau à zéro sans toucher à la collection', async () => {
    const w = await open(4)
    await ready()
    const collection = useCollectionStore()
    collection.record('Le Mat')
    emit(ctl.taskbar, 'resetLevel')
    await flushPromises()
    expect(useProgressStore().visits).toBe(0)
    expect(collection.seen.has('Le Mat')).toBe(true)
    useProgressStore().visits = 3
    emit(ctl.door, 'reset')
    await vi.waitFor(() => expect(w.find('[data-testid=win-reset]').exists()).toBe(true))
    w.unmount()
  })

  it('le menu contextuel est coupé sur le jeu, sauf sur un lien', async () => {
    const w = await open()
    await ready()
    const main = w.find('main').element
    const plain = new Event('contextmenu', { bubbles: true, cancelable: true })
    main.dispatchEvent(plain)
    expect(plain.defaultPrevented).toBe(true)
    const a = document.createElement('a')
    a.href = 'https://example.com'
    main.append(a)
    const onLink = new Event('contextmenu', { bubbles: true, cancelable: true })
    a.dispatchEvent(onLink)
    expect(onLink.defaultPrevented).toBe(false)
    w.unmount()
  })

  it('les fausses erreurs ne s’affichent que lorsque la carte est retournée', async () => {
    const w = await open(3)
    await ready()
    emit(ctl.door, 'open')
    await vi.waitFor(() => expect(ctl.activity).not.toBeNull())
    emit(ctl.activity, 'done')
    await vi.waitFor(() => expect(ctl.deck).not.toBeNull())
    emit(ctl.deck, 'pick', 'nuit')
    await vi.waitFor(() => expect(ctl.tarot).not.toBeNull())
    expect(w.find('[data-testid=errors]').exists()).toBe(false)
    emit(ctl.tarot, 'flipped')
    await flushPromises()
    expect(w.find('[data-testid=errors]').exists()).toBe(true)
    expect(ctl.errors!.props.level).toBe(3)
    w.unmount()
  })
})
