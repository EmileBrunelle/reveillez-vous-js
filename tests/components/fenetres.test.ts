// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createAppLocale } from '@/locale'
import CollectionWindow from '@/components/CollectionWindow.vue'
import ResetConfirm from '@/components/ResetConfirm.vue'
import { useCollectionStore } from '@/stores/collection'

const collect = vi.hoisted(() => vi.fn())
vi.mock('@/audio/cards', () => ({ cardCollect: collect }))
const animate = vi.hoisted(() => vi.fn(() => ({ stop: () => {} })))
vi.mock('motion-v', async (orig) => ({ ...(await orig<typeof import('motion-v')>()), animate }))

let wrapper: VueWrapper | undefined
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const ouvert = ref(false)
const attendre = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}
const reduit = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }))

describe('CollectionWindow', () => {
  const monter = async (pinia = createPinia(), vers: (s: ReturnType<typeof useCollectionStore>) => void = () => {}) => {
    setActivePinia(pinia)
    const store = useCollectionStore()
    vers(store)
    ouvert.value = true
    wrapper = mount(() => h(CollectionWindow, { modelValue: ouvert.value, 'onUpdate:modelValue': (v: boolean) => (ouvert.value = v) }), {
      attachTo: document.body,
      global: { plugins: [pinia, createAppLocale()] },
    })
    await attendre()
    return store
  }
  const cases = () => [...document.querySelectorAll('ul[role="list"] > li')] as HTMLElement[]

  it('compte les arcanes révélés et montre une case « inconnu » par arcane manquant', async () => {
    const store = await monter()
    expect(document.querySelector('[role="status"]')!.textContent).toBe(`0 / ${store.total} arcanes révélés`)
    expect(cases()).toHaveLength(store.total)
    expect(cases().every((c) => c.getAttribute('aria-label') === 'Arcane inconnu')).toBe(true)
    expect(collect).toHaveBeenCalledWith(false)
  })

  it('un arcane vu apparaît avec son numéro et son nom ; le nouveau est mis en évidence une fois', async () => {
    const pinia = createPinia()
    let nom = ''
    let numero = ''
    const store = await monter(pinia, (s) => {
      nom = s.inventory[0].nom
      numero = s.inventory[0].numero
      s.record(nom)
    })
    const vue = cases().find((c) => c.title === nom)!
    expect(vue.getAttribute('aria-label')).toBe(`${numero}, ${nom} (nouveau)`)
    expect(vue.hasAttribute('data-new')).toBe(true)
    expect(cases().filter((c) => c.hasAttribute('data-new'))).toHaveLength(1)
    expect(document.querySelector('[role="status"]')!.textContent).toBe(`1 / ${store.total} arcanes révélés`)
    expect(collect).toHaveBeenCalledWith(true)
    expect(animate).toHaveBeenCalledWith(vue, { scale: [0.86, 1] }, expect.objectContaining({ type: 'spring' }))
  })

  it('mouvement réduit : pas de ressort sur la case nouvelle', async () => {
    reduit()
    await monter(createPinia(), (s) => s.record(s.inventory[0].nom))
    expect(animate).not.toHaveBeenCalled()
  })

  it('la fermeture efface le « nouveau » du stockage', async () => {
    const store = await monter(createPinia(), (s) => s.record(s.inventory[0].nom))
    expect(store.fresh).not.toBeNull()
    ;(document.querySelector('dialog button') as HTMLButtonElement).click()
    await attendre()
    expect(ouvert.value).toBe(false)
    expect(store.fresh).toBeNull()
    expect(store.count).toBe(1) // l’arcane reste révélé
  })
})

describe('ResetConfirm', () => {
  const monter = async () => {
    ouvert.value = true
    const confirm = vi.fn()
    wrapper = mount(() => h(ResetConfirm, { modelValue: ouvert.value, 'onUpdate:modelValue': (v: boolean) => (ouvert.value = v), onConfirm: confirm }), {
      attachTo: document.body,
      global: { plugins: [createPinia(), createAppLocale()] },
    })
    await attendre()
    return confirm
  }
  const bouton = (texte: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === texte) as HTMLButtonElement

  it('s’ouvre avec la question, le focus sur « Annuler »', async () => {
    await monter()
    const d = document.querySelector('dialog') as HTMLDialogElement
    expect(d.hasAttribute('open')).toBe(true)
    expect(d.textContent).toContain('Tout oublier ?')
    expect(document.activeElement).toBe(bouton('Annuler'))
  })

  it('« Oublier » confirme', async () => {
    const confirm = await monter()
    bouton('Oublier').click()
    await attendre()
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('« Annuler » ferme sans confirmer', async () => {
    const confirm = await monter()
    bouton('Annuler').click()
    await attendre()
    expect(confirm).not.toHaveBeenCalled()
    expect(ouvert.value).toBe(false)
  })
})
