// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import FakeErrors from '@/components/FakeErrors.vue'

let wrapper: VueWrapper | undefined
let bureau = true
let changements: ((e: { matches: boolean }) => void)[] = []
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  bureau = true
  changements = []
  vi.stubGlobal('innerWidth', 1280)
  vi.stubGlobal('innerHeight', 720)
  vi.spyOn(window, 'matchMedia').mockImplementation((q) => {
    const mq = {
      get matches() {
        return bureau
      },
      media: q,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => void changements.push(cb),
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }
    return mq as unknown as MediaQueryList
  })
  // happy-dom ne fait pas de mise en page : une fenêtre rend 160 px de haut.
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(160)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const monter = (level: number) => {
  wrapper = mount(FakeErrors, { props: { level: level as 1 | 2 | 3 | 4 | 5 }, global: { plugins: [createPinia()] }, attachTo: document.body })
  return wrapper
}
const fenetres = () => wrapper!.findAll('.fake-error')

describe('FakeErrors : apparition', () => {
  it.each([1, 2])('niveau %i : aucune fausse fenêtre', async (level) => {
    monter(level)
    await vi.advanceTimersByTimeAsync(20000)
    expect(fenetres()).toHaveLength(0)
  })

  it('niveau 3 : une fenêtre après 3,5 s, nommée, avec icône, texte et boutons', async () => {
    monter(3)
    await vi.advanceTimersByTimeAsync(3400)
    expect(fenetres()).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()
    expect(fenetres()).toHaveLength(1)
    const f = fenetres()[0]
    expect(f.attributes('role')).toBe('group')
    expect(f.attributes('aria-label')).toMatch(/^Fausse erreur : .+/)
    expect(f.get('p').text().length).toBeGreaterThan(5)
    expect(f.get('[aria-hidden="true"]').text()).toMatch(/^[×!i?]$/)
    expect(f.findAll('button').length).toBeGreaterThanOrEqual(2) // la croix et au moins un bouton
    expect(f.classes()).not.toContain('invisible')
    await vi.advanceTimersByTimeAsync(1000) // revérification après la pose : la fenêtre reste
    expect(fenetres()).toHaveLength(1)
  })

  it('niveau 5 : trois fenêtres échelonnées, jamais deux fois le même message', async () => {
    monter(5)
    await vi.advanceTimersByTimeAsync(3500 + 2500 * 2 + 200)
    await nextTick()
    const titres = fenetres().map((f) => f.get('p').text())
    expect(titres.length).toBeGreaterThanOrEqual(1)
    expect(new Set(titres).size).toBe(titres.length)
  })

  it('sur téléphone (écran étroit) : rien n’apparaît', async () => {
    bureau = false
    monter(3)
    await vi.advanceTimersByTimeAsync(10000)
    expect(fenetres()).toHaveLength(0)
  })

  it('une fenêtre qui ne trouve aucune place est abandonnée', async () => {
    vi.stubGlobal('innerWidth', 100) // plus étroit qu’une fenêtre (288 px)
    monter(3)
    await vi.advanceTimersByTimeAsync(4000)
    await nextTick()
    expect(fenetres()).toHaveLength(0)
  })

  it('une hauteur nulle (mesure impossible) n’affiche rien', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(0)
    monter(3)
    await vi.advanceTimersByTimeAsync(4000)
    await nextTick()
    expect(fenetres()).toHaveLength(0)
  })
})

describe('FakeErrors : fermeture et redimensionnement', () => {
  it('la croix ferme la fenêtre', async () => {
    monter(3)
    await vi.advanceTimersByTimeAsync(3700)
    await nextTick()
    await fenetres()[0].get('button[aria-label="Fermer la fausse erreur"]').trigger('click')
    expect(fenetres()).toHaveLength(0)
  })

  it('un bouton de la fenêtre la ferme aussi', async () => {
    monter(3)
    await vi.advanceTimersByTimeAsync(3700)
    await nextTick()
    const boutons = fenetres()[0].findAll('button')
    await boutons[boutons.length - 1].trigger('click')
    expect(fenetres()).toHaveLength(0)
  })

  it('un redimensionnement qui repasse en écran étroit retire tout', async () => {
    monter(3)
    await vi.advanceTimersByTimeAsync(3700)
    await nextTick()
    expect(fenetres()).toHaveLength(1)
    bureau = false
    changements.forEach((cb) => cb({ matches: false }))
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(fenetres()).toHaveLength(0)
  })

  it('un redimensionnement qui laisse la fenêtre hors de la zone la retire', async () => {
    monter(3)
    await vi.advanceTimersByTimeAsync(3700)
    await nextTick()
    expect(fenetres()).toHaveLength(1)
    vi.stubGlobal('innerWidth', 200)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(fenetres()).toHaveLength(0)
  })
})
