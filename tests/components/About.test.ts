// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createAppLocale } from '@/locale'
import About from '@/components/About.vue'
import { provideLayoutRefs } from '@/composables/layoutRefs'
import { useOverlayStore } from '@/stores/overlay'
import { REPO_URL } from '@/content/finale'

vi.mock('@/audio/sfx', () => ({ aboutOpen: vi.fn(), aboutClose: vi.fn() }))
// Contrôles inertes : les promesses se résolvent tout de suite ; `complete` sert à vérifier le saut de l’animation.
const complete = vi.hoisted(() => vi.fn())
vi.mock('motion-v', async (orig) => ({ ...(await orig<typeof import('motion-v')>()), animate: vi.fn(() => ({ stop: () => {}, complete })) }))

import { animate } from 'motion-v'
import { aboutClose, aboutOpen } from '@/audio/sfx'

let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  principal.value = null
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// Hôte minimal : fournit les éléments de mise en page (comme App.vue) et pilote le v-model.
const ouvert = ref(true)
const principal = ref<HTMLElement | null>(null)
const Hote = defineComponent({
  setup: () => {
    provideLayoutRefs().mainEl.value = principal.value
    return () => h(About, { modelValue: ouvert.value, 'onUpdate:modelValue': (v: boolean) => (ouvert.value = v) })
  },
})
const monter = async (modelValue = true) => {
  ouvert.value = modelValue
  wrapper = mount(Hote, { attachTo: document.body, global: { plugins: [createPinia(), createAppLocale()] } })
  await nextTick()
  await nextTick()
  return wrapper
}
const avecMonde = () => {
  const main = document.createElement('div')
  document.body.append(main)
  principal.value = main
  return main
}
const dialogue = () => document.querySelector('dialog') as HTMLDialogElement
const reduit = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }))
const boutonFermer = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Fermer') as HTMLButtonElement

describe('About : contenu', () => {
  it('fermée au départ : rien d’ouvert et aucun son', async () => {
    await monter(false)
    expect(dialogue()?.hasAttribute('open') ?? false).toBe(false)
    expect(aboutOpen).not.toHaveBeenCalled()
  })

  it('ouverte : titre, présentation, code source, déclaration d’IA et attributions', async () => {
    await monter()
    expect(dialogue().hasAttribute('open')).toBe(true)
    expect(dialogue().textContent).toContain('À propos')
    expect(dialogue().textContent).toContain('Réveillez-vous.js')
    expect(dialogue().textContent).toContain('Émile Brunelle')
    expect(dialogue().textContent).toContain('Claude Code')
    expect(dialogue().textContent).toContain('CC BY 3.0')
    const liens = [...dialogue().querySelectorAll('a')].map((a) => [a.textContent?.trim(), a.getAttribute('href'), a.getAttribute('rel')])
    expect(liens).toEqual([
      ['Code source', REPO_URL, 'noopener noreferrer'],
      ['game-icons.net', 'https://game-icons.net', 'noopener noreferrer'],
    ])
  })

  it('s’inscrit comme superposition ouverte tant qu’elle est affichée', async () => {
    await monter()
    const overlay = useOverlayStore()
    expect(overlay.active).toBe(true)
    wrapper!.unmount()
    wrapper = undefined
    expect(overlay.active).toBe(false)
  })
})

describe('About : ouverture', () => {
  it('joue le son, recule le monde CRT et finit par poser la fenêtre au repos', async () => {
    const main = avecMonde()
    await monter()
    expect(aboutOpen).toHaveBeenCalledTimes(1)
    expect(animate).toHaveBeenCalledWith(main, { scale: 0.95, opacity: 0.45 }, expect.objectContaining({ duration: 0.4 }))
    await vi.advanceTimersByTimeAsync(200)
    const fenetre = dialogue().querySelector('.about__win') as HTMLElement
    expect(fenetre.style.opacity).toBe('1')
    expect(fenetre.style.clipPath).toBe('none')
    expect(fenetre.style.transform).toBe('none')
  })

  it('mouvement réduit : simple fondu, le monde ne bouge pas', async () => {
    reduit()
    const main = avecMonde()
    await monter()
    expect(animate).not.toHaveBeenCalledWith(main, expect.anything(), expect.anything())
    expect(animate).toHaveBeenCalledWith(expect.any(HTMLElement), { opacity: [0, 1] }, expect.objectContaining({ duration: 0.15 }))
  })

  it('un clic pendant l’ouverture mène les animations à leur fin et pose le repos', async () => {
    await monter()
    complete.mockClear()
    dialogue().click()
    expect(complete).toHaveBeenCalled()
    const corps = dialogue().querySelector('.p-4') as HTMLElement
    expect(corps.style.opacity).toBe('1')
  })

  it('s’ouvre aussi quand le parent passe de faux à vrai', async () => {
    await monter(false)
    ouvert.value = true
    await nextTick()
    await nextTick()
    await nextTick()
    expect(dialogue().hasAttribute('open')).toBe(true)
    expect(aboutOpen).toHaveBeenCalledTimes(1)
  })
})

describe('About : fermeture', () => {
  it('« Fermer » joue l’animation de sortie, ramène le monde, puis ferme et met le modèle à faux', async () => {
    const main = avecMonde()
    await monter()
    await vi.advanceTimersByTimeAsync(200)
    boutonFermer().click()
    await vi.advanceTimersByTimeAsync(50)
    expect(aboutClose).toHaveBeenCalledTimes(1)
    expect(animate).toHaveBeenCalledWith(main, { scale: 1, opacity: 1 }, expect.objectContaining({ duration: 0.2 }))
    await nextTick()
    await nextTick()
    expect(ouvert.value).toBe(false)
    expect(dialogue().hasAttribute('open')).toBe(false)
  })

  it('le bouton X ferme aussi, et un double clic ne rejoue pas la sortie', async () => {
    await monter()
    await vi.advanceTimersByTimeAsync(200)
    const x = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'X') as HTMLButtonElement
    x.click()
    x.click()
    await vi.advanceTimersByTimeAsync(50)
    await nextTick()
    expect(aboutClose).toHaveBeenCalledTimes(1)
    expect(ouvert.value).toBe(false)
  })

  it('Échap (cancel) est intercepté : la fenêtre se ferme par son animation', async () => {
    await monter()
    await vi.advanceTimersByTimeAsync(200)
    const e = new Event('cancel', { cancelable: true })
    dialogue().dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    await vi.advanceTimersByTimeAsync(50)
    await nextTick()
    expect(aboutClose).toHaveBeenCalledTimes(1)
    expect(ouvert.value).toBe(false)
  })

  it('mouvement réduit : la sortie est un fondu sans mouvement du monde', async () => {
    reduit()
    await monter()
    await vi.advanceTimersByTimeAsync(200)
    boutonFermer().click()
    await vi.advanceTimersByTimeAsync(50)
    expect(animate).toHaveBeenCalledWith(expect.any(HTMLElement), { opacity: [1, 0] }, expect.objectContaining({ duration: 0.1 }))
    await nextTick()
    expect(ouvert.value).toBe(false)
  })

  it('la fermeture par le parent (modèle à faux) joue aussi la sortie', async () => {
    await monter()
    await vi.advanceTimersByTimeAsync(200)
    ouvert.value = false
    await vi.advanceTimersByTimeAsync(50)
    expect(aboutClose).toHaveBeenCalledTimes(1)
  })
})
