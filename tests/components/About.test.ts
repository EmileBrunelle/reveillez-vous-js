// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createAppLocale } from '@/locale'
import About from '@/components/About.vue'
import { useOverlayStore } from '@/stores/overlay'
import { REPO_URL } from '@/content/finale'

vi.mock('@/audio/sfx', () => ({ aboutOpen: vi.fn(), aboutClose: vi.fn() }))
import { aboutClose, aboutOpen } from '@/audio/sfx'

let wrapper: VueWrapper | undefined
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

// Hôte minimal : pilote le v-model comme App.vue.
const ouvert = ref(true)
const Hote = defineComponent({
  setup: () => () => h(About, { modelValue: ouvert.value, 'onUpdate:modelValue': (v: boolean) => (ouvert.value = v) }),
})
const monter = async (modelValue = true) => {
  ouvert.value = modelValue
  wrapper = mount(Hote, { attachTo: document.body, global: { plugins: [createPinia(), createAppLocale()] } })
  await nextTick()
  await nextTick()
}
const dialogue = () => document.querySelector('dialog') as HTMLDialogElement
const bouton = (nom: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === nom) as HTMLButtonElement

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

  it('style Windows 98 standard et fixe : fenêtre grise, barre de titre sans poignée de glissement', async () => {
    await monter()
    expect(dialogue().querySelector('.win-window')).not.toBeNull()
    expect(dialogue().querySelector('.cursor-move')).toBeNull()
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

describe('About : ouverture et fermeture', () => {
  it('ouverte d’emblée : son d’ouverture, focus sur « Fermer »', async () => {
    await monter()
    expect(aboutOpen).toHaveBeenCalledTimes(1)
    expect(document.activeElement?.textContent?.trim()).toBe('Fermer')
  })

  it('s’ouvre aussi quand le parent passe de faux à vrai', async () => {
    await monter(false)
    ouvert.value = true
    await nextTick()
    await nextTick()
    expect(dialogue().hasAttribute('open')).toBe(true)
    expect(aboutOpen).toHaveBeenCalledTimes(1)
  })

  it('« Fermer » ferme d’un coup, met le modèle à faux et joue le son de fermeture', async () => {
    await monter()
    bouton('Fermer').click()
    await nextTick()
    await nextTick()
    expect(ouvert.value).toBe(false)
    expect(dialogue().hasAttribute('open')).toBe(false)
    expect(aboutClose).toHaveBeenCalledTimes(1)
  })

  it('la croix de la barre de titre ferme aussi', async () => {
    await monter()
    bouton('×').click()
    await nextTick()
    await nextTick()
    expect(ouvert.value).toBe(false)
    expect(aboutClose).toHaveBeenCalledTimes(1)
  })

  it('la fermeture par le parent (modèle à faux) joue aussi le son', async () => {
    await monter()
    ouvert.value = false
    await nextTick()
    await nextTick()
    expect(aboutClose).toHaveBeenCalledTimes(1)
    expect(dialogue().hasAttribute('open')).toBe(false)
  })
})
