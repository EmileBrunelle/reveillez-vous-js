// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import Finale from '@/components/Finale.vue'
import { CREDITS_THANKS, FINALE_GREETING, FINALE_STORY, FINALE_TITLE, README_LABEL, REPO_URL, RESTART_LABEL, SKIP_HINT_POINTER } from '@/content/finale'
import { useCollectionStore } from '@/stores/collection'

// Séquence sonore remplacée par des espions : on vérifie qu’elle suit la séquence visuelle.
const audio = vi.hoisted(() => ({ powerDown: vi.fn(), dawn: vi.fn(), bell: vi.fn(), fadePad: vi.fn(), stop: vi.fn() }))
vi.mock('@/audio/finale', () => ({ BELL_DELAY: 1, startFinaleAudio: () => audio }))

let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  Object.values(audio).forEach((f) => f.mockClear())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const monter = () => {
  wrapper = mount(Finale, { attachTo: document.body, global: { plugins: [createPinia()] } })
  return wrapper
}
const avancer = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const reduit = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }))
const texte = () => document.body.textContent ?? ''
const bouton = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === RESTART_LABEL) as HTMLButtonElement | undefined
const LONGUEUR = FINALE_TITLE.length + FINALE_STORY.length + 1

describe('Finale : séquence normale', () => {
  it('éteint la télé, émet collapsed, lève l’aube, puis écrit le texte ligne par ligne', async () => {
    const w = monter()
    await avancer(60)
    expect(audio.powerDown).toHaveBeenCalledTimes(1)
    await avancer(1500)
    expect(w.emitted('collapsed')).toHaveLength(1)
    expect(audio.dawn).not.toHaveBeenCalled()
    await avancer(800)
    expect(audio.dawn).toHaveBeenCalledTimes(1)
    expect(texte()).not.toContain(FINALE_TITLE[0])
    await avancer(2500) // début du texte : une ligne
    expect(w.get('section [role="status"][aria-relevant="additions"]').findAll('p')).toHaveLength(1)
    await avancer(1800)
    expect(w.get('section [role="status"][aria-relevant="additions"]').findAll('p')).toHaveLength(2)
    expect(w.get('section [role="status"][aria-relevant="additions"]').text()).toContain(FINALE_TITLE[1])
  })

  it('va jusqu’au salut (cloche), puis au générique avec son bouton « Recommencer »', async () => {
    const w = monter()
    await avancer(60 + 1500 + 800 + 2500 + 1800 + 2200 * 2 + 3400 * FINALE_STORY.length)
    expect(audio.bell).toHaveBeenCalledTimes(1)
    expect(w.get('section').text()).toContain(FINALE_GREETING)
    expect(audio.fadePad).not.toHaveBeenCalled()
    await avancer(4200 + 100)
    expect(audio.fadePad).toHaveBeenCalledTimes(1)
    await avancer(3000)
    expect(texte()).toContain(CREDITS_THANKS)
    expect(texte()).toContain('Arcanes révélés : 0 sur')
    const lien = [...document.querySelectorAll('a')].find((a) => a.textContent?.includes(README_LABEL))!
    expect(lien.getAttribute('href')).toBe(`${REPO_URL}#readme`)
    expect(lien.getAttribute('target')).toBe('_blank')
    expect(w.get('[role="status"]').text()).toContain(CREDITS_THANKS)
    expect(bouton()?.textContent?.trim()).toBe(RESTART_LABEL)
    bouton()!.click()
    expect(w.emitted('restart')).toHaveLength(1)
    // Le focus se pose sur « Recommencer » après le délai des ressorts.
    await avancer(800)
    expect(document.activeElement).toBe(bouton())
  })

  it('le compteur du générique reflète la collection', async () => {
    const pinia = createPinia()
    wrapper = mount(Finale, { attachTo: document.body, global: { plugins: [pinia] } })
    const store = useCollectionStore(pinia)
    store.record(store.inventory[0].nom)
    store.record(store.inventory[1].nom)
    await avancer(40000)
    expect(texte()).toContain(`Arcanes révélés : 2 sur ${store.total}`)
  })

  it('l’indice « pour passer » : version souris par défaut', async () => {
    monter()
    await avancer(1600)
    expect(texte()).toContain(SKIP_HINT_POINTER)
  })

  it('l’indice tactile apparaît quand le pointeur est grossier', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('coarse'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }))
    monter()
    await avancer(1600)
    expect(texte()).toContain('Touchez l’écran pour passer')
  })
})

describe('Finale : passer la séquence', () => {
  it('un clic ailleurs affiche tout d’un coup : générique, collapsed émis une fois, audio coupé', async () => {
    const w = monter()
    await avancer(100) // encore sous les barres : le décor doit quand même passer à l’aube
    document.body.click()
    await nextTick()
    await avancer(300)
    expect(w.emitted('collapsed')).toHaveLength(1)
    expect(audio.stop).toHaveBeenCalledWith(false)
    expect(texte()).toContain(CREDITS_THANKS)
    expect(bouton()?.textContent?.trim()).toBe(RESTART_LABEL)
    expect(w.emitted('restart')).toBeUndefined() // le clic ailleurs n’active pas « Recommencer »
    await avancer(30000)
    expect(w.emitted('collapsed')).toHaveLength(1) // la séquence est arrêtée
    expect(audio.bell).not.toHaveBeenCalled()
  })

  it('Entrée et Espace passent aussi ; les autres touches non', async () => {
    const w = monter()
    await avancer(100)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await avancer(100)
    expect(texte()).not.toContain(CREDITS_THANKS)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await avancer(300)
    expect(texte()).toContain(CREDITS_THANKS)
    expect(w.emitted('collapsed')).toHaveLength(1)
  })

  it('un clic sur un bouton ne passe pas la séquence (et « Recommencer » garde son comportement)', async () => {
    const w = monter()
    const b = document.createElement('button')
    document.body.append(b)
    await avancer(100)
    b.click()
    await avancer(100)
    expect(texte()).not.toContain(CREDITS_THANKS)
    expect(w.emitted('restart')).toBeUndefined()
  })

  it('déjà au générique, un clic ne rejoue rien (et ne coupe pas le son à nouveau)', async () => {
    const w = monter()
    await avancer(40000)
    audio.stop.mockClear()
    document.body.click()
    await avancer(100)
    expect(audio.stop).not.toHaveBeenCalled()
    expect(bouton()?.textContent?.trim()).toBe(RESTART_LABEL)
    expect(w.emitted('collapsed')).toHaveLength(1) // un seul effondrement, le clic tardif n’en ajoute pas
    expect(w.emitted('restart')).toBeUndefined()
  })

  it('un clic pendant le texte saute au générique', async () => {
    const w = monter()
    await avancer(60 + 1500 + 800 + 2500 + 1800 + 100)
    expect(w.emitted('collapsed')).toHaveLength(1)
    document.body.click()
    await avancer(300)
    expect(texte()).toContain(CREDITS_THANKS)
    expect(w.get('section').text()).not.toContain(FINALE_GREETING) // le texte a laissé la place
  })
})

describe('Finale : mouvement réduit', () => {
  it('tout est affiché sans animation, collapsed tout de suite, le son d’aube et la cloche joués', async () => {
    reduit()
    const w = monter()
    expect(w.emitted('collapsed')).toHaveLength(1)
    expect(audio.dawn).toHaveBeenCalledTimes(1)
    expect(audio.bell).toHaveBeenCalledTimes(1)
    await avancer(200)
    expect(texte()).toContain(FINALE_TITLE[0])
    expect(texte()).toContain(FINALE_GREETING)
    expect(texte()).toContain(CREDITS_THANKS)
    expect(w.get('[role="status"]').text()).toContain(CREDITS_THANKS)
    await avancer(5000)
    expect(audio.fadePad).toHaveBeenCalledTimes(1)
    await avancer(500)
    expect(document.activeElement).toBe(bouton())
    expect(texte()).not.toContain(SKIP_HINT_POINTER)
  })

  it('cliquer ne passe rien (tout est déjà là) et ne coupe pas la nappe', async () => {
    reduit()
    monter()
    await avancer(200)
    document.body.click()
    await avancer(100)
    expect(audio.stop).not.toHaveBeenCalled()
    expect(LONGUEUR).toBeGreaterThan(3)
  })
})

describe('Finale : focus et destruction', () => {
  it('focus() expose le focus sur la section « Finale »', () => {
    const w = monter()
    ;(w.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(w.get('section[aria-label="Finale"]').element)
  })

  it('démonter coupe le son', () => {
    const w = monter()
    w.unmount()
    wrapper = undefined
    expect(audio.stop).toHaveBeenCalled()
  })
})
