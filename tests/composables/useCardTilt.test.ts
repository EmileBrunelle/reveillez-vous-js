// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'
import { useCardTilt } from '@/composables/useCardTilt'

type PointerInit = { x?: number; y?: number; type?: string; id?: number }
const pointer = (target: EventTarget, name: string, { x = 0, y = 0, type = 'mouse', id = 1 }: PointerInit = {}) => {
  const e = new Event(name, { bubbles: true })
  Object.assign(e, { clientX: x, clientY: y, pointerType: type, pointerId: id })
  target.dispatchEvent(e)
}
// Une image (rAF simulé), puis le flush des watchers de useCssVar qui écrivent sur l’élément.
const flush = async () => {
  await nextTick()
}
const frame = async () => {
  vi.advanceTimersByTime(20)
  await flush()
}

// Carte de 200×400 à l’origine : le centre est en (100, 200).
const setup = (over: { settled?: boolean; reduced?: boolean } = {}) => {
  const root = document.createElement('div')
  const tiltEl = document.createElement('div')
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 400, right: 200, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  root.setPointerCapture = vi.fn()
  const settled = ref(over.settled ?? true)
  const reduced = ref(over.reduced ?? false)
  const scope = effectScope()
  const api = scope.run(() => useCardTilt({ root: shallowRef(root), tilt: shallowRef(tiltEl), settled, reduced }))!
  const v = (name: string) => tiltEl.style.getPropertyValue(name)
  return { root, tiltEl, settled, reduced, scope, api, v }
}

describe('useCardTilt : pointeur', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('au repos : variables initiales posées sur l’élément incliné', async () => {
    const { v, scope } = setup()
    expect(v('--ry')).toBe('0deg')
    expect(v('--rx')).toBe('0deg')
    expect(v('--gx')).toBe('50%')
    expect(v('--glare')).toBe('0')
    scope.stop()
  })

  it('la souris à droite du centre incline vers la droite (8° max) et pousse le reflet', async () => {
    const { v, scope } = setup()
    pointer(window, 'pointermove', { x: 200, y: 200 }) // dx = 0,5 ; dy = 0
    await frame()
    expect(v('--ry')).toBe('4deg')
    expect(v('--rx')).toBe('0deg')
    expect(v('--gx')).toBe('80%')
    expect(v('--gy')).toBe('50%')
    expect(v('--glare')).toBe('1')
    scope.stop()
  })

  it('en haut de la carte, rx est positif (la carte se penche vers l’arrière) ; l’écart est borné à ±1', async () => {
    const { v, scope } = setup()
    pointer(window, 'pointermove', { x: 1000, y: -1000 })
    await frame()
    expect(v('--ry')).toBe('8deg')
    expect(v('--rx')).toBe('8deg')
    expect(v('--gx')).toBe('110%')
    expect(v('--gy')).toBe('-10%')
    scope.stop()
  })

  it('une seule écriture par image : le dernier point reçu l’emporte', async () => {
    const { v, scope } = setup()
    pointer(window, 'pointermove', { x: 0, y: 200 })
    pointer(window, 'pointermove', { x: 200, y: 200 })
    expect(v('--ry')).toBe('0deg') // rien n’est écrit avant l’image
    await frame()
    expect(v('--ry')).toBe('4deg')
    scope.stop()
  })

  it('aucune inclinaison tant que la carte n’est pas posée, ni en mouvement réduit', async () => {
    const a = setup({ settled: false })
    pointer(window, 'pointermove', { x: 200, y: 200 })
    await frame()
    expect(a.v('--ry')).toBe('0deg')
    a.settled.value = true
    a.reduced.value = true
    pointer(window, 'pointermove', { x: 200, y: 200 })
    await frame()
    expect(a.v('--ry')).toBe('0deg')
    a.reduced.value = false
    pointer(window, 'pointermove', { x: 200, y: 200 })
    await frame()
    expect(a.v('--ry')).toBe('4deg')
    a.scope.stop()
  })

  it('le pointeur quitte la page : l’écriture en attente est annulée et la carte revient à plat', async () => {
    const { v, scope } = setup()
    pointer(window, 'pointermove', { x: 200, y: 200 })
    await frame()
    pointer(window, 'pointermove', { x: 0, y: 0 })
    pointer(document, 'pointerleave')
    await frame()
    expect(v('--ry')).toBe('0deg')
    expect(v('--rx')).toBe('0deg')
    expect(v('--glare')).toBe('0')
    scope.stop()
  })

  it('un mouvement du pointeur sans carte posée ne laisse aucune écriture en attente', async () => {
    const { v, scope, settled } = setup()
    settled.value = false
    pointer(window, 'pointermove', { x: 200, y: 200 })
    settled.value = true
    await frame()
    expect(v('--ry')).toBe('0deg')
    scope.stop()
  })
})

describe('useCardTilt : doigt', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('un glissement au doigt incline la carte et capture le pointeur', async () => {
    const { api, root, v, scope } = setup()
    const down = { x: 100, y: 200, type: 'touch', id: 7 }
    api.onTouchDown(new Event('pointerdown') as PointerEvent & { pointerType: string })
    // Événement construit à la main : pointerType manquant → ignoré (rien ne doit se passer).
    expect(root.setPointerCapture).not.toHaveBeenCalled()
    const e = Object.assign(new Event('pointerdown'), { clientX: down.x, clientY: down.y, pointerType: 'touch', pointerId: down.id }) as PointerEvent
    api.onTouchDown(e)
    expect(root.setPointerCapture).toHaveBeenCalledWith(7)
    pointer(window, 'pointermove', { x: 200, y: 200, type: 'touch' })
    await frame()
    expect(v('--ry')).toBe('4deg')
    expect(api.wasDrag()).toBe(true)
    scope.stop()
  })

  it('un tap (déplacement sous le seuil) n’incline pas et n’est pas un glissement', async () => {
    const { api, v, scope } = setup()
    api.onTouchDown(Object.assign(new Event('pointerdown'), { clientX: 100, clientY: 200, pointerType: 'touch', pointerId: 1 }) as PointerEvent)
    pointer(window, 'pointermove', { x: 103, y: 202, type: 'touch' })
    await frame()
    expect(v('--ry')).toBe('0deg')
    expect(api.wasDrag()).toBe(false)
    scope.stop()
  })

  it('un mouvement tactile sans contact préalable est ignoré', async () => {
    const { v, scope } = setup()
    pointer(window, 'pointermove', { x: 200, y: 200, type: 'touch' })
    await frame()
    expect(v('--ry')).toBe('0deg')
    scope.stop()
  })

  it('une capture refusée par le navigateur n’interrompt pas le geste', async () => {
    const { api, root, v, scope } = setup()
    root.setPointerCapture = vi.fn(() => {
      throw new Error('refusée')
    })
    api.onTouchDown(Object.assign(new Event('pointerdown'), { clientX: 100, clientY: 200, pointerType: 'touch', pointerId: 1 }) as PointerEvent)
    pointer(window, 'pointermove', { x: 200, y: 200, type: 'touch' })
    await frame()
    expect(v('--ry')).toBe('4deg')
    scope.stop()
  })

  it('contact refusé quand la carte n’est pas posée ou en mouvement réduit : pas de capture', async () => {
    const a = setup({ settled: false })
    a.api.onTouchDown(Object.assign(new Event('pointerdown'), { clientX: 1, clientY: 1, pointerType: 'touch', pointerId: 1 }) as PointerEvent)
    expect(a.root.setPointerCapture).not.toHaveBeenCalled()
    const b = setup({ reduced: true })
    b.api.onTouchDown(Object.assign(new Event('pointerdown'), { clientX: 1, clientY: 1, pointerType: 'touch', pointerId: 1 }) as PointerEvent)
    expect(b.root.setPointerCapture).not.toHaveBeenCalled()
    a.scope.stop()
    b.scope.stop()
  })

  it('relâché : retour à plat, `releasing` vrai 650 ms puis faux', async () => {
    const { api, v, scope } = setup()
    api.onTouchDown(Object.assign(new Event('pointerdown'), { clientX: 100, clientY: 200, pointerType: 'touch', pointerId: 1 }) as PointerEvent)
    pointer(window, 'pointermove', { x: 200, y: 200, type: 'touch' })
    await frame()
    expect(api.releasing.value).toBe(false)
    pointer(window, 'pointerup', { type: 'touch' })
    await flush()
    expect(v('--ry')).toBe('0deg')
    expect(v('--glare')).toBe('0')
    expect(api.releasing.value).toBe(true)
    vi.advanceTimersByTime(649)
    expect(api.releasing.value).toBe(true)
    vi.advanceTimersByTime(2)
    expect(api.releasing.value).toBe(false)
    scope.stop()
  })

  it('un pointerup de souris, ou sans doigt posé, ne déclenche pas de retour', async () => {
    const { api, scope } = setup()
    pointer(window, 'pointerup', { type: 'mouse' })
    pointer(window, 'pointercancel', { type: 'touch' })
    expect(api.releasing.value).toBe(false)
    scope.stop()
  })
})

describe('useCardTilt : gyroscope', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('screen', { orientation: { angle: 0, addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window) } })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  const orient = (beta: number, gamma: number) => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma }))

  it('le téléphone qui penche incline la carte en sens inverse, plus ample que la souris (20°)', async () => {
    const { v, scope } = setup()
    orient(0, 0) // référence
    orient(0, 15) // 15° vers la droite : plein débattement
    vi.advanceTimersByTime(2000)
    await flush()
    expect(parseFloat(v('--ry'))).toBeLessThan(-10)
    expect(parseFloat(v('--ry'))).toBeGreaterThanOrEqual(-20)
    expect(v('--glare')).toBe('1')
    scope.stop()
  })

  it('une fois la souris utilisée, le gyroscope ne pilote plus la carte', async () => {
    const { v, scope } = setup()
    pointer(window, 'pointermove', { x: 100, y: 200, type: 'mouse' })
    vi.advanceTimersByTime(20)
    orient(0, 0)
    orient(0, 15)
    vi.advanceTimersByTime(2000)
    await flush()
    expect(v('--ry')).toBe('0deg')
    scope.stop()
  })
})
