// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import FakeErrors from '@/components/FakeErrors.vue'
import TaskbarWindows from '@/components/TaskbarWindows.vue'
import { useWindowsStore } from '@/stores/windows'

let wrapper: VueWrapper | undefined
let bureau = true
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  bureau = true
  vi.stubGlobal('innerWidth', 1280)
  vi.stubGlobal('innerHeight', 720)
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q) =>
      ({
        get matches() {
          return q.includes('min-width') ? bureau : false
        },
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
      }) as unknown as MediaQueryList,
  )
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(160) // happy-dom ne fait pas de mise en page
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// Les fenêtres et, avec `barre`, les boutons de la barre des tâches (pour les cas où le focus doit y atterrir).
const Ensemble = defineComponent({ render: () => [h(FakeErrors, { level: 5 }), h(TaskbarWindows)] })
const monter = async (level: 3 | 5 = 5, barre = false) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(barre ? Ensemble : FakeErrors, { props: barre ? {} : { level }, global: { plugins: [pinia] }, attachTo: document.body })
  await vi.advanceTimersByTimeAsync(3500 + 2500 * 2 + 200)
  await nextTick()
  return useWindowsStore()
}
const fenetres = () => wrapper!.findAll('.fake-error')
const zOf = (i: number) => Number((fenetres()[i].element as HTMLElement).style.zIndex)

describe('FakeErrors : gestionnaire de fenêtres', () => {
  it('chaque fenêtre posée est ouverte dans le store, titre et icône compris', async () => {
    const windows = await monter()
    expect(fenetres().length).toBeGreaterThanOrEqual(2)
    expect(windows.windows).toHaveLength(fenetres().length)
    expect(windows.windows[0].title).toBe(fenetres()[0].get('span.truncate').text())
  })

  it('un pointerdown sur la fenêtre du dessous la passe devant', async () => {
    const windows = await monter()
    expect(fenetres().length).toBeGreaterThanOrEqual(2)
    const dessous = windows.windows[0].id
    expect(windows.activeId).not.toBe(dessous)
    expect(zOf(0)).toBeLessThan(zOf(1))
    await fenetres()[0].get('p').trigger('pointerdown')
    expect(windows.activeId).toBe(dessous)
    expect(zOf(0)).toBeGreaterThan(zOf(1))
  })

  it('le bouton « _ » réduit la fenêtre : inerte, masquée, bouton toujours dans le store', async () => {
    const windows = await monter()
    const f = fenetres()[0]
    const id = windows.windows[0].id
    const animer = vi.fn(() => ({ finished: Promise.resolve(), cancel: () => {} }))
    vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(animer as never)
    await f.get('button[aria-label="Réduire la fausse erreur"]').trigger('click')
    await vi.advanceTimersByTimeAsync(50)
    expect(animer).toHaveBeenCalledTimes(1) // le vol vers le bouton (sans bouton dans ce montage : repli en fondu)
    expect(windows.find(id)?.minimized).toBe(true)
    expect(f.attributes('inert')).toBeDefined()
    expect(f.classes()).toContain('invisible') // arrivée au bouton : masquée
    windows.restore(id)
    await vi.advanceTimersByTimeAsync(50)
    expect(animer).toHaveBeenCalledTimes(2) // et le retour
    expect(f.attributes('inert')).toBeUndefined()
    expect(f.classes()).not.toContain('invisible')
  })

  it('OK ferme la fenêtre : elle quitte le store', async () => {
    const windows = await monter()
    const avant = fenetres().length
    const f = fenetres()[0]
    const id = windows.windows[0].id
    await f
      .findAll('button')
      .filter((b) => !b.attributes('aria-label'))[0]
      .trigger('click')
    await nextTick()
    expect(fenetres()).toHaveLength(avant - 1)
    expect(windows.find(id)).toBeUndefined()
  })

  it('le démontage (fin de la lecture) vide le store', async () => {
    const windows = await monter()
    expect(windows.windows.length).toBeGreaterThan(0)
    wrapper!.unmount()
    wrapper = undefined
    expect(windows.windows).toEqual([])
  })

  it('une fenêtre déplacée ne disparaît pas quand l’écran rétrécit (une non déplacée, si)', async () => {
    const windows = await monter(3)
    expect(fenetres()).toHaveLength(1)
    const id = windows.windows[0].id
    windows.setOffset(id, { x: 20, y: 10 })
    vi.stubGlobal('innerWidth', 150)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(fenetres()).toHaveLength(1)
    windows.setOffset(id, { x: 0, y: 0 })
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(fenetres()).toHaveLength(0)
    expect(windows.windows).toEqual([]) // et son bouton part avec elle
  })

  it('fermer B quand A est réduite : le focus ne va pas sur la croix inerte de A mais sur son bouton de la barre', async () => {
    const windows = await monter(5, true)
    const [a, b, ...autres] = windows.windows.map((w) => w.id)
    for (const id of [a, ...autres]) windows.minimize(id) // seule B reste visible
    await nextTick()
    const okB = wrapper!.get(`.fake-error[data-id="${b}"] button:not([aria-label])`)
    ;(okB.element as HTMLElement).focus()
    await okB.trigger('click')
    await nextTick()
    await nextTick()
    const actif = document.activeElement as HTMLElement
    expect(actif.closest('[inert]')).toBeNull()
    expect(actif.getAttribute('data-win-btn')).toBe(String(a))
  })

  it('fermer B quand A est visible : le focus passe à la croix de A', async () => {
    const windows = await monter(5, true)
    const [a, b] = windows.windows.map((w) => w.id)
    const okB = wrapper!.get(`.fake-error[data-id="${b}"] button:not([aria-label])`)
    ;(okB.element as HTMLElement).focus()
    await okB.trigger('click')
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(wrapper!.get(`.fake-error[data-id="${a}"] button[aria-label="Fermer la fausse erreur"]`).element)
  })

  it('restaurer depuis le bouton de la barre renvoie le focus dans la fenêtre (premier bouton)', async () => {
    const windows = await monter(5, true)
    vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation((() => ({ finished: Promise.resolve(), cancel: () => {} })) as never)
    const id = windows.windows[0].id
    const btn = wrapper!.get(`[data-win-btn="${id}"]`)
    windows.minimize(id)
    await vi.advanceTimersByTimeAsync(300)
    ;(btn.element as HTMLElement).focus()
    await btn.trigger('click') // toggle → restaure
    await vi.advanceTimersByTimeAsync(300)
    const premier = wrapper!.get(`.fake-error[data-id="${id}"] button`).element
    expect(document.activeElement).toBe(premier)
  })

  it('une fenêtre réduite ne compte plus pour placer les suivantes', async () => {
    const windows = await monter(5)
    const n = fenetres().length
    expect(n).toBeGreaterThanOrEqual(2)
    for (const w of windows.windows) windows.minimize(w.id)
    window.dispatchEvent(new Event('resize')) // revérification : les réduites restent, même si l’écran a changé
    vi.stubGlobal('innerWidth', 150)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(fenetres()).toHaveLength(n)
    expect(windows.windows).toHaveLength(n)
  })

  it('useWinFlight : aucune écriture après le démontage', async () => {
    const animer = vi.fn(() => ({ finished: new Promise(() => {}), cancel: vi.fn() }))
    vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(animer as never)
    const windows = await monter(5)
    const f = fenetres()[0]
    windows.minimize(windows.windows[0].id)
    await nextTick()
    wrapper!.unmount()
    wrapper = undefined
    const anim = animer.mock.results[0].value as { cancel: ReturnType<typeof vi.fn> }
    expect(anim.cancel).toHaveBeenCalled()
    expect(f.classes()).not.toContain('invisible')
  })

  it('plafonne les fenêtres ouvertes à 5', async () => {
    const src = (await import('node:fs')).readFileSync('src/components/FakeErrors.vue', 'utf8')
    expect(src).toContain('MAX_OPEN = 5')
    expect(src).toMatch(/wins\.value\.length >= MAX_OPEN/)
  })
})
