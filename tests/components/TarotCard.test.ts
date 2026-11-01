// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import TarotCard from '@/components/TarotCard.vue'
import { useSessionStore } from '@/stores/session'
import type { Arcane } from '@/engine/prophecy'

// `~icons/…?raw` n’est pas résoluble sous Vitest : le masque d’emblème est remplacé.
vi.mock('@/engine/emblemMask', () => ({ emblemMask: (s: string) => `url(masque-${s})` }))
// Le reflet passe par Web Animations (happy-dom annule la promesse de `useAnimate`) : remplacé par un espion.
const shimmer = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useCardShimmer', () => ({ useCardShimmer: () => ({ shimmer, shimmering: ref(false) }) }))
vi.mock('@/audio/sfx', () => ({ cardFlip: vi.fn(), cardThud: vi.fn() }))
// Les animations Motion sont remplacées par des contrôles inertes : les promesses se résolvent tout de suite.
// `usePresence` est enveloppé pour récupérer `onExit` (la sortie `stow` que lance AnimatePresence).
const presence = vi.hoisted(() => ({ onExit: undefined as undefined | (() => Promise<void> | void) }))
vi.mock('motion-v', async (orig) => {
  const mod = await orig<typeof import('motion-v')>()
  return {
    ...mod,
    animate: vi.fn(() => ({ stop: () => {} })),
    usePresence: (o: Parameters<typeof mod.usePresence>[0]) => {
      presence.onExit = o.onExit as typeof presence.onExit
      return mod.usePresence(o)
    },
  }
})
import { animate } from 'motion-v'

import { cardFlip, cardThud } from '@/audio/sfx'

const ARCANE: Arcane = { numero: 'XVIII', nom: 'La Lune dérangée', symbole: 'moon', paquet: 'nuit' }
const PROPS = { arcane: ARCANE, title: 'Vous retrouverez vos clés', body: 'Elles dormaient dans le frigo, à côté du lait.', verse: 'Même le lait sait.' }

let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const monter = (props: Record<string, unknown> = {}) => {
  wrapper = mount(TarotCard, { props: { ...PROPS, ...props }, attachTo: document.body, global: { plugins: [createPinia()] } })
  return wrapper
}
const reduit = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }))

describe('TarotCard : contenu', () => {
  it('affiche le numéro, le titre, le texte, le vers et le nom de l’arcane', () => {
    const w = monter()
    expect(w.get('.tarot__numero').text()).toBe('XVIII')
    expect(w.get('h2').text()).toBe(PROPS.title)
    expect(w.get('h2').attributes('data-text')).toBe(PROPS.title)
    expect(w.get('.tarot__body').text()).toBe(PROPS.body)
    expect(w.get('.tarot__verse').text()).toBe('— Même le lait sait.')
    expect(w.get('.tarot__banner').text()).toBe('La Lune dérangée')
  })

  it('porte le niveau et le paquet en classes', () => {
    const w = monter({ level: 4, paquet: 'feu' })
    expect(w.classes()).toEqual(expect.arrayContaining(['tarot--l4', 'tarot--feu']))
  })

  it('niveau et paquet par défaut : 1 et nuit', () => {
    const w = monter()
    expect(w.classes()).toEqual(expect.arrayContaining(['tarot--l1', 'tarot--nuit']))
  })

  it('la taille du titre diminue avec sa longueur', () => {
    const taille = (titre: string) => {
      const w = monter({ title: titre })
      const v = (w.get('.tarot__content').element as HTMLElement).style.getPropertyValue('--title')
      w.unmount()
      wrapper = undefined
      return parseFloat(v)
    }
    const court = taille('Court')
    const moyen = taille('x'.repeat(50))
    const long = taille('x'.repeat(80))
    expect(court).toBeGreaterThan(moyen)
    expect(moyen).toBeGreaterThan(long)
  })
})

describe('TarotCard : retournement', () => {
  it('au départ le dos est visible : face cachée aux lecteurs d’écran, rien d’annoncé', () => {
    const w = monter()
    expect(w.get('.tarot__front').attributes('aria-hidden')).toBe('true')
    expect(w.get('.tarot__back').attributes('aria-hidden')).toBe('false')
    expect(w.get('.tarot__sr').text()).toBe('')
  })

  it('se retourne seule après la pause : son, annonce, bruit sourd, onde CRT et événement flipped', async () => {
    const w = monter()
    const session = useSessionStore()
    const seq0 = session.knock.seq
    await vi.advanceTimersByTimeAsync(150)
    expect(cardFlip).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(180)
    expect(w.get('.tarot__sr').text()).toBe('Carte retournée : La Lune dérangée.')
    expect(w.get('.tarot__front').attributes('aria-hidden')).toBe('false')
    expect(w.get('.tarot__back').attributes('aria-hidden')).toBe('true')
    await vi.advanceTimersByTimeAsync(10)
    expect(cardThud).toHaveBeenCalledTimes(1)
    expect(shimmer).toHaveBeenCalledTimes(1)
    expect(session.knock.seq).toBe(seq0 + 1)
    expect(w.emitted('flipped')).toHaveLength(1)
  })

  it('un clic pendant le retournement montre la face tout de suite, sans bruit de pose multiple', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(50)
    await w.trigger('click')
    expect(w.get('.tarot__sr').text()).toBe('Carte retournée : La Lune dérangée.')
    await vi.advanceTimersByTimeAsync(3000)
    // Le raccourci arrête la chaîne : ni son de retournement, ni événement tardif.
    expect(cardFlip).not.toHaveBeenCalled()
    expect(w.emitted('flipped')).toBeUndefined()
    await w.trigger('click') // deuxième clic : sans effet
    expect(w.get('.tarot__sr').text()).toBe('Carte retournée : La Lune dérangée.')
  })

  it('mouvement réduit : face visible sans animation, bruit sourd seul, pas d’onde', async () => {
    reduit()
    const w = monter()
    const session = useSessionStore()
    await vi.advanceTimersByTimeAsync(150)
    expect(cardFlip).not.toHaveBeenCalled()
    expect(cardThud).toHaveBeenCalledTimes(1)
    expect(session.knock.seq).toBe(0)
    expect(shimmer).not.toHaveBeenCalled()
    expect(w.get('.tarot__sr').text()).toBe('Carte retournée : La Lune dérangée.')
    expect(w.emitted('flipped')).toHaveLength(1)
  })
})

describe('TarotCard : destruction', () => {
  it('démonter avant la fin n’émet rien', async () => {
    const w = monter()
    await vi.advanceTimersByTimeAsync(100)
    w.unmount()
    wrapper = undefined
    await vi.advanceTimersByTimeAsync(5000)
    expect(cardFlip).not.toHaveBeenCalled()
  })
})

describe('sortie (stow)', () => {
  it('une animation qui ne se résout jamais libère quand même la présence après le délai', async () => {
    monter()
    vi.mocked(animate).mockImplementation((() => new Promise(() => {})) as never)
    let libre = false
    void Promise.resolve(presence.onExit?.()).then(() => (libre = true))
    await vi.advanceTimersByTimeAsync(100)
    expect(libre).toBe(false)
    await vi.advanceTimersByTimeAsync(1500)
    expect(libre).toBe(true)
  })

  it('une animation rejetée (AbortError) libère aussi la présence', async () => {
    monter()
    vi.mocked(animate).mockImplementation((() => Promise.reject(new DOMException('annulée', 'AbortError'))) as never)
    await expect(Promise.resolve(presence.onExit?.())).resolves.toBeUndefined()
  })
})
