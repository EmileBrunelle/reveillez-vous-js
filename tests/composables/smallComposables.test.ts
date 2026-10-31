// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file -- composants de test : plusieurs par fichier */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, shallowRef, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const ro = vi.hoisted(() => ({ cb: null as null | (() => void) }))
vi.mock('@vueuse/core', async (orig) => ({
  ...(await orig<typeof import('@vueuse/core')>()),
  useResizeObserver: (_t: unknown, cb: () => void) => {
    ro.cb = cb
  },
}))
const animate = vi.hoisted(() => vi.fn())
vi.mock('motion-v', async (orig) => ({ ...(await orig<typeof import('motion-v')>()), animate }))

import { useDeferredText } from '@/composables/useDeferredText'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useShake } from '@/composables/useShake'
import { BASE_TITLE, useTabTitle } from '@/composables/useTabTitle'
import { useBubbles } from '@/composables/useBubbles'
import { useKeyboardModality } from '@/composables/useKeyboardModality'
import { activeHtmlElement, focusQuietly } from '@/composables/focusQuietly'
import { MAX_PULSE_MS, MIN_GAP_MS, resetPulseLimiter, useHaptics } from '@/composables/haptics'
import { provideLayoutRefs, registerLayoutEl, useLayoutRefs } from '@/composables/layoutRefs'
import { useFreeZones } from '@/composables/useFreeZones'
import { useProgressStore } from '@/stores/progress'
import { useSessionStore } from '@/stores/session'
import { nextTick as tick } from 'vue'

// Monte un composant vide dont le setup exécute `fn` (les composables VueUse/Vue y ont un vrai cycle de vie).
const withSetup = <T>(fn: () => T) => {
  let result!: T
  const wrapper = mount(
    defineComponent({
      setup() {
        result = fn()
        return () => h('div')
      },
    }),
  )
  return { result, wrapper }
}

const warn = vi.spyOn(console, 'warn')
beforeEach(() => warn.mockClear())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  expect(warn).not.toHaveBeenCalled() // zéro avertissement Vue
})

describe('useDeferredText', () => {
  it('monte vide (région aria-live), se remplit après 150 ms et suit la source ensuite', async () => {
    vi.useFakeTimers()
    const source = ref('Connexion')
    const { result: text, wrapper } = withSetup(() => useDeferredText(() => source.value))
    expect(text.value).toBe('')
    vi.advanceTimersByTime(149)
    expect(text.value).toBe('')
    vi.advanceTimersByTime(2)
    expect(text.value).toBe('Connexion')
    source.value = 'Autre'
    expect(text.value).toBe('Autre')
    wrapper.unmount()
  })
})

describe('useReducedMotion', () => {
  const stub = (reduce: boolean) =>
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: reduce && q.includes('reduce'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }))

  it('vrai quand le système demande moins de mouvement', () => {
    stub(true)
    const { result, wrapper } = withSetup(() => useReducedMotion())
    expect(result.value).toBe(true)
    wrapper.unmount()
  })

  it('faux sinon', () => {
    stub(false)
    const { result, wrapper } = withSetup(() => useReducedMotion())
    expect(result.value).toBe(false)
    wrapper.unmount()
  })
})

describe('useShake', () => {
  const stubMotion = (reduce: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {} }))
  beforeEach(() => animate.mockClear())

  it('secoue l’élément : amplitude 10 × amp en x, plus faible en y, sans roulis par défaut', () => {
    stubMotion(false)
    const el = document.createElement('div')
    const { result: shake, wrapper } = withSetup(() => useShake(shallowRef(el)))
    shake(2)
    const [target, keyframes, opts] = animate.mock.calls[0]!
    expect(target).toBe(el)
    expect(keyframes.x).toEqual([0, -20, 16, -10, 6, 0])
    expect(keyframes.y[0]).toBe(0)
    expect(keyframes.y.at(-1)).toBe(0)
    expect(keyframes.rotate).toBeUndefined()
    expect(opts).toEqual({ duration: 0.35 })
    wrapper.unmount()
  })

  it('avec `rotate` : ajoute un roulis amorti de 0,6° par unité d’amplitude', () => {
    stubMotion(false)
    const { result: shake, wrapper } = withSetup(() => useShake(shallowRef(document.createElement('div')), { rotate: true }))
    shake(1)
    expect(animate.mock.calls[0]![1].rotate).toEqual([0, -0.6, 0.6 * 0.7, -0.6 * 0.4, 0.6 * 0.15, 0])
    wrapper.unmount()
  })

  it('rien en mouvement réduit, ni sans élément', () => {
    stubMotion(true)
    const a = withSetup(() => useShake(shallowRef(document.createElement('div'))))
    a.result(1)
    stubMotion(false)
    const b = withSetup(() => useShake(shallowRef<HTMLElement | null>(null)))
    b.result(1)
    expect(animate).not.toHaveBeenCalled()
    a.wrapper.unmount()
    b.wrapper.unmount()
  })
})

describe('useTabTitle', () => {
  let visibility: 'visible' | 'hidden' = 'visible'
  const setVisibility = async (v: 'visible' | 'hidden') => {
    visibility = v
    document.dispatchEvent(new Event('visibilitychange'))
    await tick()
    await tick()
  }
  beforeEach(() => {
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true })
    localStorage.clear()
  })

  it('caché : le titre devient une ligne du niveau ; au retour, le titre normal', async () => {
    const level = ref(2) as Ref<1 | 2 | 3 | 4 | 5>
    const { wrapper } = withSetup(() => useTabTitle(level))
    await tick()
    expect(document.title).toBe(BASE_TITLE)
    await setVisibility('hidden')
    expect(document.title).not.toBe(BASE_TITLE)
    expect(document.title.length).toBeGreaterThan(0)
    await setVisibility('visible')
    expect(document.title).toBe(BASE_TITLE)
    wrapper.unmount()
  })
})

describe('useBubbles', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    localStorage.clear()
  })
  const make = (visits: number) => {
    useProgressStore().visits = visits
    return { ...withSetup(() => useBubbles(() => 0.3)), session: useSessionStore() }
  }

  it('niveau 2+ : une bulle apparaît 2,5 s après le démarrage', () => {
    const { result, session, wrapper } = make(2)
    result.startBubble()
    vi.advanceTimersByTime(2499)
    expect(session.notifications).toHaveLength(0)
    vi.advanceTimersByTime(2)
    expect(session.notifications).toHaveLength(1)
    expect(session.notifications[0]!.text.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('niveau 1 : aucune bulle', () => {
    const { result, session, wrapper } = make(0)
    result.startBubble()
    vi.advanceTimersByTime(5000)
    expect(session.notifications).toHaveLength(0)
    wrapper.unmount()
  })

  it('stopBubble annule l’attente ; clearBubbles retire toutes les bulles affichées', () => {
    const { result, session, wrapper } = make(2)
    result.startBubble()
    result.stopBubble()
    vi.advanceTimersByTime(5000)
    expect(session.notifications).toHaveLength(0)
    session.notify('a', 'b')
    session.notify('c', 'd')
    result.clearBubbles()
    expect(session.notifications).toHaveLength(0)
    wrapper.unmount()
  })
})

describe('useKeyboardModality et focusQuietly', () => {
  it('une touche de navigation passe en mode clavier ; un pointeur en sort ; une touche ordinaire ne change rien', () => {
    const kb = useKeyboardModality()
    window.dispatchEvent(new Event('pointerdown'))
    expect(kb.value).toBe(false)
    window.dispatchEvent(Object.assign(new Event('keydown'), { key: 'a' }))
    expect(kb.value).toBe(false)
    window.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Tab' }))
    expect(kb.value).toBe(true)
    window.dispatchEvent(new Event('pointerdown'))
    expect(kb.value).toBe(false)
  })

  it('focusQuietly : sans anneau après la souris, options inchangées après le clavier, sans effet sans élément', () => {
    const el = document.createElement('button')
    const spy = vi.spyOn(el, 'focus')
    window.dispatchEvent(new Event('pointerdown'))
    focusQuietly(el, { preventScroll: true })
    expect(spy).toHaveBeenLastCalledWith({ preventScroll: true, focusVisible: false })
    window.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Enter' }))
    focusQuietly(el, { preventScroll: true })
    expect(spy).toHaveBeenLastCalledWith({ preventScroll: true })
    spy.mockClear()
    focusQuietly(null)
    focusQuietly(undefined)
    expect(spy).not.toHaveBeenCalled()
  })

  it('activeHtmlElement renvoie l’élément focalisé (body compris)', () => {
    const b = document.createElement('button')
    document.body.append(b)
    b.focus()
    expect(activeHtmlElement()).toBe(b)
    b.remove()
    expect(activeHtmlElement()).toBe(document.body)
  })
})

describe('useHaptics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetPulseLimiter()
  })
  afterEach(() => {
    resetPulseLimiter()
    delete (navigator as { vibrate?: unknown }).vibrate
  })

  it('Android : vibre, durée bornée à 30 ms, et refuse une rafale (écart minimal de 90 ms)', () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true })
    const { result, wrapper } = withSetup(() => useHaptics())
    expect(result.pulse(500)).toBe(true)
    expect(vibrate).toHaveBeenLastCalledWith(MAX_PULSE_MS)
    expect(result.pulse(20)).toBe(false)
    vi.advanceTimersByTime(MIN_GAP_MS + 1)
    expect(result.pulse(20)).toBe(true)
    expect(vibrate).toHaveBeenLastCalledWith(20)
    wrapper.unmount()
  })

  it('sans API vibrate (iOS) : rien', () => {
    delete (navigator as { vibrate?: unknown }).vibrate
    const { result, wrapper } = withSetup(() => useHaptics())
    expect(result.pulse(20)).toBe(false)
    wrapper.unmount()
  })
})

describe('layoutRefs', () => {
  it('l’élément enregistré par un composant est lu par un frère, puis libéré au démontage', async () => {
    const shown = ref(true)
    let refs!: ReturnType<typeof provideLayoutRefs>
    let seen!: ReturnType<typeof useLayoutRefs>
    const Child = defineComponent({
      setup() {
        const el = shallowRef<HTMLElement | null>(null)
        const { mainEl } = useLayoutRefs()
        registerLayoutEl(mainEl, el)
        return () => h('main', { ref: el })
      },
    })
    const Sibling = defineComponent({
      setup() {
        seen = useLayoutRefs()
        return () => h('i')
      },
    })
    const Parent = defineComponent({
      setup() {
        refs = provideLayoutRefs()
        return () => h('div', [shown.value ? h(Child) : null, h(Sibling)])
      },
    })
    const wrapper = mount(Parent, { attachTo: document.body })
    await nextTick()
    expect(seen.mainEl).toBe(refs.mainEl)
    expect(refs.mainEl.value?.tagName).toBe('MAIN')
    shown.value = false
    await nextTick()
    expect(refs.mainEl.value).toBeNull()
    wrapper.unmount()
  })

  it('sans fournisseur : références vides locales, aucun avertissement', () => {
    const { result, wrapper } = withSetup(() => useLayoutRefs())
    expect(result.mainEl.value).toBeNull()
    expect(result.tarotEl.value).toBeNull()
    expect(result.taskbarEl.value).toBeNull()
    wrapper.unmount()
  })

  it('une référence déjà remplacée par un autre composant n’est pas effacée à la libération', async () => {
    const target = shallowRef<HTMLElement | null>(null)
    const el = shallowRef<HTMLElement | null>(document.createElement('a'))
    const { wrapper } = withSetup(() => registerLayoutEl(target, el))
    await nextTick()
    const other = document.createElement('b')
    target.value = other
    wrapper.unmount()
    expect(target.value).toBe(other)
  })
})

describe('useFreeZones', () => {
  const rect = (l: number, t: number, r: number, b: number) => () => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t, x: l, y: t, toJSON: () => ({}) }) as DOMRect

  it('avec un fournisseur : les boîtes reflètent les éléments enregistrés et area() s’arrête au haut de la barre', () => {
    const onChange = vi.fn()
    const main = document.createElement('main')
    const btn = document.createElement('button')
    main.append(btn, document.createElement('p'))
    btn.getBoundingClientRect = rect(1, 2, 3, 4)
    const tarot = document.createElement('div')
    tarot.getBoundingClientRect = rect(10, 10, 50, 90)
    const bar = document.createElement('div')
    bar.getBoundingClientRect = rect(0, 700, 1024, 768)
    let zones!: ReturnType<typeof useFreeZones>
    const Child = defineComponent({
      setup() {
        zones = useFreeZones(onChange)
        return () => h('i')
      },
    })
    const wrapper = mount(
      defineComponent({
        setup() {
          const refs = provideLayoutRefs()
          refs.mainEl.value = main
          refs.tarotEl.value = tarot
          refs.taskbarEl.value = bar
          return () => h(Child)
        },
      }),
    )
    const boxes = zones.avoidBoxes()
    expect(boxes).toHaveLength(4) // bouton, carte, barre, bulle
    expect(boxes[0]).toEqual({ left: 1, top: 2, right: 3, bottom: 4 })
    expect(boxes[1]).toEqual({ left: 10, top: 10, right: 50, bottom: 90 })
    expect(boxes[2]).toEqual({ left: 0, top: 700, right: 1024, bottom: 768 })
    const area = zones.area()
    expect(area.bottom).toBe(700)
    expect(area.left).toBeGreaterThanOrEqual(0)
    expect(area.right).toBeLessThanOrEqual(window.innerWidth)
    // Un changement de taille de la carte ou de la colonne prévient l’appelant.
    ro.cb!()
    expect(onChange).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('sans éléments enregistrés : seule la bulle, et la zone s’étend jusqu’en bas de la fenêtre', () => {
    const { result: zones, wrapper } = withSetup(() => useFreeZones(() => {}))
    expect(zones.avoidBoxes()).toHaveLength(1)
    expect(zones.area().bottom).toBe(window.innerHeight)
    wrapper.unmount()
  })
})
