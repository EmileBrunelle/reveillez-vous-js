// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { requestOrientationPermission, useDeviceTilt } from '@/composables/useTilt'

describe('requestOrientationPermission', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sans DeviceOrientationEvent ou sans requestPermission : ne fait rien', () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined)
    expect(() => requestOrientationPermission()).not.toThrow()
    vi.stubGlobal('DeviceOrientationEvent', class {})
    expect(() => requestOrientationPermission()).not.toThrow()
  })

  it('iOS : demande la permission une fois, et ignore un refus', async () => {
    const requestPermission = vi.fn(() => Promise.reject(new Error('refusé')))
    vi.stubGlobal('DeviceOrientationEvent', { requestPermission })
    requestOrientationPermission()
    expect(requestPermission).toHaveBeenCalledOnce()
    await Promise.resolve() // le rejet est capté : aucun rejet non géré ne fait échouer le test
  })

  it('ignore une exception synchrone de requestPermission', () => {
    vi.stubGlobal('DeviceOrientationEvent', {
      requestPermission: () => {
        throw new Error('sync')
      },
    })
    expect(() => requestOrientationPermission()).not.toThrow()
  })
})

describe('useDeviceTilt', () => {
  let angle = 0
  let visibility: 'visible' | 'hidden' = 'visible'
  const orientation = new EventTarget() as EventTarget & { angle: number }
  const orient = (beta: number | null, gamma: number | null) => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma }))
  const setVisibility = async (v: 'visible' | 'hidden') => {
    visibility = v
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick() // le watcher qui oublie la référence tourne au prochain flush
  }
  const mount = (enabled: () => boolean = () => true) => {
    const apply = vi.fn()
    const scope = effectScope()
    scope.run(() => useDeviceTilt({ enabled, apply }))
    const last = () => apply.mock.calls.at(-1) as [number, number]
    return { apply, scope, last }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    angle = 0
    visibility = 'visible'
    Object.defineProperty(orientation, 'angle', { get: () => angle, configurable: true })
    vi.stubGlobal('screen', { orientation })
    Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('la première lecture sert de référence : aucune inclinaison, puis un écart de 15° donne le plein débattement (1)', () => {
    const { apply, last, scope } = mount()
    orient(10, 5)
    vi.advanceTimersByTime(200)
    expect(last()[0]).toBeCloseTo(0, 5)
    expect(last()[1]).toBeCloseTo(0, 5)
    orient(10, 20) // gamma +15° : droite
    vi.advanceTimersByTime(3000)
    expect(last()[0]).toBeGreaterThan(0.9)
    expect(Math.abs(last()[1])).toBeLessThan(0.1)
    expect(apply).toHaveBeenCalled()
    scope.stop()
  })

  it('un écart supérieur à la plage est borné à 1', () => {
    const { last, scope } = mount()
    orient(0, 0)
    orient(60, 0) // beta +60° : bas
    vi.advanceTimersByTime(3000)
    expect(last()[1]).toBeLessThanOrEqual(1)
    expect(last()[1]).toBeGreaterThan(0.95)
    scope.stop()
  })

  it('la boucle de lissage se met en pause une fois la cible atteinte', () => {
    const { apply, scope } = mount()
    orient(0, 0)
    vi.advanceTimersByTime(5000)
    const n = apply.mock.calls.length
    vi.advanceTimersByTime(5000)
    expect(apply.mock.calls.length).toBe(n)
    scope.stop()
  })

  it('lectures nulles, onglet caché ou désactivé : ignorées', async () => {
    let on = false
    const { apply, scope } = mount(() => on)
    orient(null, 3)
    orient(3, null)
    orient(0, 0) // désactivé
    vi.advanceTimersByTime(500)
    expect(apply).not.toHaveBeenCalled()
    on = true
    await setVisibility('hidden')
    orient(0, 0)
    vi.advanceTimersByTime(500)
    expect(apply).not.toHaveBeenCalled()
    scope.stop()
  })

  it('au retour de l’onglet caché, une nouvelle référence est prise (pas de saut)', async () => {
    const { last, scope } = mount()
    orient(0, 0)
    await setVisibility('hidden')
    await setVisibility('visible')
    orient(0, 40) // sans nouvelle référence, ce serait un grand écart
    vi.advanceTimersByTime(3000)
    expect(Math.abs(last()[0])).toBeLessThan(0.05)
    scope.stop()
  })

  it('paysage (90°) : les axes sont échangés (beta = vers la droite de l’écran)', () => {
    const { last, scope } = mount()
    angle = 90
    orient(0, 0)
    orient(15, 0) // beta +15° = droite à 90°
    vi.advanceTimersByTime(3000)
    expect(last()[0]).toBeGreaterThan(0.9)
    scope.stop()
  })

  it('180° et 270° : axes et signes inversés', () => {
    const a = mount()
    angle = 180
    orient(0, 0)
    orient(0, -15) // x = -gamma = +15
    vi.advanceTimersByTime(3000)
    expect(a.last()[0]).toBeGreaterThan(0.9)
    a.scope.stop()
    const b = mount()
    angle = 270
    orient(0, 0)
    orient(-15, 0) // x = -beta = +15
    vi.advanceTimersByTime(3000)
    expect(b.last()[0]).toBeGreaterThan(0.9)
    b.scope.stop()
  })

  it('rotation d’écran : référence oubliée et lectures ignorées pendant ~500 ms', () => {
    const { apply, last, scope } = mount()
    orient(0, 0)
    vi.advanceTimersByTime(3000)
    apply.mockClear()
    orientation.dispatchEvent(new Event('change'))
    orient(0, 40) // dans la fenêtre de stabilisation : ignoré
    vi.advanceTimersByTime(300)
    expect(Math.abs(last()?.[0] ?? 0)).toBeLessThan(0.05)
    vi.advanceTimersByTime(400)
    orient(0, 40) // nouvelle référence
    vi.advanceTimersByTime(3000)
    expect(Math.abs(last()[0])).toBeLessThan(0.05)
    scope.stop()
  })

  it('sans screen.orientation : écoute orientationchange sur window', () => {
    vi.stubGlobal('screen', {})
    const { apply, scope } = mount()
    orient(0, 0)
    window.dispatchEvent(new Event('orientationchange'))
    orient(0, 40)
    vi.advanceTimersByTime(200)
    // la lecture est dans la fenêtre d’oubli : aucune inclinaison non nulle n’a été appliquée
    for (const [x] of apply.mock.calls) expect(Math.abs(x)).toBeLessThan(0.05)
    scope.stop()
  })
})
