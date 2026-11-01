// @vitest-environment happy-dom
import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFrameBudget } from '@/composables/useFrameBudget'
import { useQualityStore } from '@/stores/quality'

// rAF simulé : le test fait avancer les images à la main (`tick(ms)`), sans minuterie réelle.
let queue: ((t: number) => void)[] = []
let now = 0
const tick = (ms: number) => {
  now += ms
  const q = queue
  queue = []
  q.forEach((cb) => cb(now))
}
const setVisibility = async (v: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
  document.dispatchEvent(new Event('visibilitychange'))
  await nextTick()
}

beforeEach(() => {
  queue = []
  now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now) // le magasin date ses mesures avec performance.now
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => queue.push(cb))
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    queue = []
  })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
  setActivePinia(createPinia())
})
afterEach(async () => {
  await setVisibility('visible')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const setup = (active: () => boolean) => {
  const scope = effectScope()
  scope.run(() => useFrameBudget(active))
  return { scope, quality: useQualityStore() }
}

describe('useFrameBudget', () => {
  it('aucune boucle au repos : rien ne tourne tant qu’aucune animation n’est en cours', async () => {
    const on = ref(false)
    const { scope } = setup(() => on.value)
    expect(queue).toHaveLength(0)
    on.value = true
    await nextTick()
    expect(queue).toHaveLength(1)
    on.value = false
    await nextTick()
    expect(queue).toHaveLength(0)
    scope.stop()
  })

  it('n’échantillonne pas pendant la première seconde, puis mesure les durées d’image', async () => {
    const { scope, quality } = setup(() => true)
    for (let i = 0; i < 40; i++) tick(16) // ~640 ms : grâce
    expect(quality.stats(now)?.frame).toBeNull()
    for (let i = 0; i < 40; i++) tick(16)
    expect(quality.stats(now)?.frame?.mean).toBeCloseTo(16, 0)
    scope.stop()
  })

  it('onglet caché : la boucle s’arrête ; à la reprise, la grâce recommence (les mesures d’avant ne comptent plus)', async () => {
    const { scope, quality } = setup(() => true)
    for (let i = 0; i < 100; i++) tick(16)
    await setVisibility('hidden')
    expect(queue).toHaveLength(0)
    await setVisibility('visible')
    expect(queue).toHaveLength(1)
    tick(16) // première image après la reprise : pas de durée connue
    for (let i = 0; i < 30; i++) tick(16) // ~500 ms : toujours dans la grâce de 1 s
    expect(quality.stats(now)?.frame).toBeNull()
    expect(quality.level).toBe('high')
    scope.stop()
  })

  it('jeu en pause (active faux) : la boucle s’arrête et le niveau ne bouge pas, même avec des images lentes avant', async () => {
    const on = ref(true)
    const { scope, quality } = setup(() => on.value)
    on.value = false
    await nextTick()
    for (let i = 0; i < 200; i++) tick(60)
    expect(quality.level).toBe('high')
    scope.stop()
  })

  it('images lentes en continu : descend d’un niveau', async () => {
    const { scope, quality } = setup(() => true)
    for (let i = 0; i < 200; i++) tick(40)
    expect(quality.level).toBe('medium')
    scope.stop()
  })
})
