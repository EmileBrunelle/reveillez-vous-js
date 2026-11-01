// @vitest-environment happy-dom
import './horlogeGlobale'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import OuijaActivity from '@/components/activities/OuijaActivity.vue'
import { ACTIVITY_PROMPTS } from '@/content/activityPrompts'
import { ACTIVITY_GRACE_MS, durationOf, outcomeMsOf } from '@/engine/activityTiming'
import { OUIJA_ROWS } from '@/engine/ouija'
import { mulberry32 } from '@/engine/rng'
import { ouijaFarewell, ouijaTick } from '@/audio/ouija'
import { avancer, evenementPointeur, fenetrePerdFocus, horloge, mouvementReduit, rect, reprendre } from './aide'

// happy-dom annule mal les animations natives (AbortError non gérée) ; le ressort de la goutte est remplacé par un suivi immédiat
// (la physique de Motion n’est pas l’objet du test, et son rendu ne suit pas les fausses horloges).
vi.mock('motion-v', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion-v')>()),
  animate: vi.fn(() => ({ stop: () => {}, finished: Promise.resolve() })),
  useSpring: (source: { get: () => number; set: (v: number) => void }) => ({ get: () => source.get(), jump: (v: number) => source.set(v), getVelocity: () => 0 }),
}))
// Pas de mise en page dans happy-dom : la scène mesure 800 × 600.
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useElementBounding: () => ({ left: ref(0), top: ref(0), width: ref(800), height: ref(600) }),
}))
vi.mock('@/audio/ouija', () => ({ ouijaTick: vi.fn(), ouijaFarewell: vi.fn() }))

// Planche factice : lettres en grille de 7 colonnes, OUI/NON en haut, AU REVOIR en bas à droite.
const POSITIONS: Record<string, DOMRect> = {
  OUI: rect(100, 100, 80, 40),
  NON: rect(300, 100, 80, 40),
  'AU REVOIR': rect(560, 520, 160, 40),
}
OUIJA_ROWS.forEach((row, r) => [...row].forEach((l, c) => (POSITIONS[`Lettre ${l}`] = rect(100 + c * 60, 200 + r * 60, 40, 40))))
const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

let wrapper: VueWrapper | undefined
let avertissements: ReturnType<typeof vi.spyOn>[] = []
beforeEach(() => {
  horloge()
  vi.mocked(ouijaTick).mockClear()
  vi.mocked(ouijaFarewell).mockClear()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return POSITIONS[this.getAttribute('aria-label') ?? ''] ?? rect(0, 0, 800, 600)
  })
  avertissements = [vi.spyOn(console, 'warn').mockImplementation(() => {}), vi.spyOn(console, 'error').mockImplementation(() => {})]
})
afterEach(() => {
  for (const spy of avertissements) expect(spy).not.toHaveBeenCalled()
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.clearAllTimers()
  vi.restoreAllMocks()
})

const monter = async (level = 1, seed = 42) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(OuijaActivity, { props: { level, rng: mulberry32(seed) }, attachTo: document.body, global: { plugins: [pinia] } })
  await avancer(200)
  return wrapper
}
const hud = (w: VueWrapper) => w.get('[data-testid="activity-hud"]')
const annonce = (w: VueWrapper) => w.get('p[aria-live="polite"]').text()
const attendue = (w: VueWrapper) => w.find('button.letter.next').text()
const touche = (w: VueWrapper, l: string) => w.get(`button[aria-label="Lettre ${l}"]`)
// Cases du mot : celles dont la bordure est pleine sont épelées.
const motLongueur = (w: VueWrapper) => w.findAll('p')[2].findAll('span').length
const frapper = (key: string, init: KeyboardEventInit = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
const vers = (w: VueWrapper, l: string, type = 'mouse') => {
  const c = centre(POSITIONS[`Lettre ${l}`])
  w.element.dispatchEvent(evenementPointeur('pointermove', { clientX: c.x, clientY: c.y, pointerType: type }))
}
// Épelle tout le mot en cliquant la lettre attendue ; renvoie les lettres cliquées.
const epeler = async (w: VueWrapper) => {
  const lettres: string[] = []
  while (w.find('button.letter.next').exists()) {
    const l = attendue(w)
    lettres.push(l)
    await touche(w, l).trigger('click')
    await avancer(1800) // laisse passer la dérive éventuelle
  }
  return lettres
}

describe('OuijaActivity : survol de la lettre attendue', () => {
  it('garder la goutte 500 ms sur la lettre attendue la valide', async () => {
    const w = await monter()
    const l = attendue(w)
    vers(w, l)
    await avancer(300)
    expect(annonce(w)).toMatch(/^Épelez le mot/)
    await avancer(400)
    expect(annonce(w)).toMatch(new RegExp(`^Lettre ${l}\\. 1 sur \\d+\\.$`))
    expect(ouijaTick).toHaveBeenCalledTimes(1)
  })

  it('une autre lettre survolée ne valide rien ; le survol retombe quand la goutte part', async () => {
    const w = await monter()
    const l = attendue(w)
    const autre = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((x) => x !== l)!
    vers(w, autre)
    await avancer(2000)
    expect(ouijaTick).not.toHaveBeenCalled()
    // Moitié du temps sur la bonne lettre puis départ : la progression redescend, rien n’est validé.
    vers(w, l)
    await avancer(300)
    vers(w, autre)
    await avancer(1500)
    vers(w, l)
    await avancer(300)
    expect(ouijaTick).not.toHaveBeenCalled()
  })

  it('au toucher, la goutte se tient 40 px au-dessus du doigt', async () => {
    const w = await monter()
    const l = attendue(w)
    const c = centre(POSITIONS[`Lettre ${l}`])
    // Le doigt est 40 px plus bas que la lettre : le point visé est sur la lettre.
    w.element.dispatchEvent(evenementPointeur('pointerdown', { clientX: c.x, clientY: c.y + 40, pointerType: 'touch' }))
    await avancer(700)
    expect(ouijaTick).toHaveBeenCalledTimes(1)
  })

  it('le mot entier au survol réussit : AU REVOIR, issue, fin émise après la durée de l’issue', async () => {
    const w = await monter()
    for (let n = 0; n < 12 && w.find('button.letter.next').exists(); n++) {
      vers(w, attendue(w))
      await avancer(700)
      await avancer(1800)
    }
    expect(w.find('button.letter.next').exists()).toBe(false)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.ouija.win)
    expect(ouijaFarewell).toHaveBeenCalledTimes(1)
    await avancer(outcomeMsOf('ouija') + 100)
    expect(w.emitted('done')).toHaveLength(1)
  })
})

describe('OuijaActivity : clics et lettres', () => {
  it('une bonne lettre cliquée avance le mot, une mauvaise dit laquelle est attendue', async () => {
    const w = await monter()
    const l = attendue(w)
    const autre = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((x) => x !== l)!
    await touche(w, autre).trigger('click')
    await avancer(1)
    expect(annonce(w)).toBe(`${autre} : ce n’est pas la bonne lettre. La lettre attendue est ${l}.`)
    expect(ouijaTick).not.toHaveBeenCalled()
    await touche(w, l).trigger('click')
    expect(annonce(w)).toMatch(new RegExp(`^Lettre ${l}\\. 1 sur \\d+\\.$`))
    expect(ouijaTick).toHaveBeenCalledTimes(1)
    // La case du mot épelée change d’état et la lettre « pop » une fois.
    expect(touche(w, l).classes()).toContain('pop')
    await avancer(400)
    expect(touche(w, l).classes()).not.toContain('pop')
  })

  it('épeler tout le mot par clics : salut AU REVOIR, issue, puis fin émise', async () => {
    const w = await monter()
    const lettres = await epeler(w)
    expect(lettres.length).toBeGreaterThanOrEqual(motLongueur(w))
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.ouija.win)
    expect(ouijaFarewell).toHaveBeenCalledTimes(1)
    expect(w.emitted('done')).toBeUndefined()
    await avancer(outcomeMsOf('ouija') + 100)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('le clavier : lettre juste, lettre fausse (message), touche non lettre ignorée, répétition ignorée', async () => {
    const w = await monter()
    const l = attendue(w)
    const autre = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((x) => x !== l)!
    frapper(autre.toLowerCase())
    await avancer(1)
    expect(annonce(w)).toContain('ce n’est pas la bonne lettre')
    frapper('Enter')
    frapper('1')
    expect(ouijaTick).not.toHaveBeenCalled()
    frapper(l.toLowerCase(), { repeat: true })
    expect(ouijaTick).not.toHaveBeenCalled()
    frapper(l.toLowerCase())
    expect(ouijaTick).toHaveBeenCalledTimes(1)
  })

  it('mouvement réduit : le mot se valide sans « pop »', async () => {
    mouvementReduit(true)
    const w = await monter()
    const l = attendue(w)
    await touche(w, l).trigger('click')
    expect(touche(w, l).classes()).not.toContain('pop')
    expect(touche(w, l).classes()).toContain('no-motion')
  })
})

describe('OuijaActivity : dérive vers NON (niveau 4 et plus)', () => {
  it('une fois dans le mot, la goutte dérive vers NON : les lettres sont refusées jusqu’à son retour', async () => {
    const w = await monter(5)
    let derive = false
    for (let n = 0; n < 12 && !derive && w.find('button.letter.next').exists(); n++) {
      await touche(w, attendue(w)).trigger('click')
      await avancer(1)
      derive = annonce(w) === 'Quelque chose retient la goutte…'
    }
    expect(derive).toBe(true)
    // Pendant la dérive, une bonne lettre n’est pas acceptée.
    const l = attendue(w)
    const avant = vi.mocked(ouijaTick).mock.calls.length
    await touche(w, l).trigger('click')
    frapper(l.toLowerCase())
    expect(vi.mocked(ouijaTick).mock.calls.length).toBe(avant)
    await avancer(1750)
    expect(annonce(w)).toBe('La goutte est relâchée.')
    await touche(w, l).trigger('click')
    expect(vi.mocked(ouijaTick).mock.calls.length).toBe(avant + 1)
  })

  it('pendant la retenue, une main spectrale et la réplique sont visibles ; au relâchement, elles disparaissent', async () => {
    const w = await monter(5)
    expect(w.find('.ghost').exists()).toBe(false)
    expect(w.find('.held-line').exists()).toBe(false)
    for (let n = 0; n < 12 && !annonce(w).includes('retient') && w.find('button.letter.next').exists(); n++) {
      await touche(w, attendue(w)).trigger('click')
      await avancer(1)
    }
    expect(w.find('.ghost .ghost-hand').exists()).toBe(true)
    expect(w.get('.held-line').text()).toBe('Quelque chose retient la goutte…')
    // La main est décorative : seule la région aria-live annonce la réplique.
    expect(w.get('.held-line').attributes('aria-hidden')).toBe('true')
    await avancer(1750)
    expect(w.find('.ghost').exists()).toBe(false)
    expect(w.find('.held-line').exists()).toBe(false)
  })

  it('mouvement réduit : la main garde sa classe « no-motion » (aucune oscillation), la réplique reste', async () => {
    mouvementReduit(true)
    const w = await monter(5)
    for (let n = 0; n < 12 && !annonce(w).includes('retient') && w.find('button.letter.next').exists(); n++) {
      await touche(w, attendue(w)).trigger('click')
      await avancer(1)
    }
    expect(w.get('.ghost').classes()).toContain('no-motion')
    expect(w.find('.held-line').exists()).toBe(true)
  })

  it('une seule dérive par mot', async () => {
    const w = await monter(5)
    let derives = 0
    while (w.find('button.letter.next').exists()) {
      await touche(w, attendue(w)).trigger('click')
      await avancer(1)
      if (annonce(w).includes('retient')) derives++
      await avancer(1800)
    }
    expect(derives).toBe(1)
  })
})

describe('OuijaActivity : issue, pause et clavier de la planche', () => {
  it('sans épellation, l’échec arrive : pas de salut, le mot reste incomplet', async () => {
    const w = await monter()
    await touche(w, attendue(w)).trigger('click')
    await avancer(durationOf('ouija') + ACTIVITY_GRACE_MS + 100)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.ouija.fail)
    expect(ouijaFarewell).not.toHaveBeenCalled()
    expect(w.find('button.letter.next').exists()).toBe(true)
    // Plus de lettre acceptée après l’issue.
    const avant = vi.mocked(ouijaTick).mock.calls.length
    await touche(w, attendue(w)).trigger('click')
    expect(vi.mocked(ouijaTick).mock.calls.length).toBe(avant)
    await avancer(outcomeMsOf('ouija') + 100)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('en pause, les lettres tapées ne comptent pas et le survol est gelé ; « Reprendre » rend la main', async () => {
    const w = await monter()
    const l = attendue(w)
    vers(w, l)
    await avancer(250)
    fenetrePerdFocus()
    await avancer(50)
    frapper(l.toLowerCase())
    await avancer(5000)
    expect(ouijaTick).not.toHaveBeenCalled()
    expect(w.text()).toContain('EN PAUSE')
    await reprendre(w)
    await avancer(600)
    expect(ouijaTick).toHaveBeenCalledTimes(1)
  })

  it('une dérive qui expire pendant la pause ne rend la goutte qu’à la reprise', async () => {
    const w = await monter(5)
    for (let n = 0; n < 12 && !annonce(w).includes('retient') && w.find('button.letter.next').exists(); n++) {
      await touche(w, attendue(w)).trigger('click')
      await avancer(1)
    }
    expect(annonce(w)).toContain('retient')
    fenetrePerdFocus()
    await avancer(5000)
    expect(annonce(w)).toContain('retient')
    await reprendre(w)
    await avancer(50)
    expect(annonce(w)).toBe('La goutte est relâchée.')
  })

  it('la planche n’a qu’un arrêt de tabulation ; les flèches déplacent le focus entre les lettres', async () => {
    const w = await monter()
    const lettres = w.findAll('button.letter')
    expect(lettres.filter((b) => b.attributes('tabindex') === '0')).toHaveLength(1)
    for (const nom of ['OUI', 'NON']) expect(w.get(`button[aria-label="${nom}"]`).attributes('tabindex')).toBe('-1')
    const tabulable = lettres.find((b) => b.attributes('tabindex') === '0')!
    ;(tabulable.element as HTMLElement).focus()
    await tabulable.trigger('keydown', { key: 'ArrowRight' })
    await avancer(1)
    const apres = w.findAll('button.letter').find((b) => b.attributes('tabindex') === '0')!
    expect(apres.text()).not.toBe(tabulable.text())
    expect(document.activeElement).toBe(apres.element)
  })

  it('la lettre attendue est marquée « next » et le mot affiche autant de cases que de lettres', async () => {
    const w = await monter()
    expect(w.findAll('button.letter.next')).toHaveLength(1)
    expect(motLongueur(w)).toBeGreaterThan(1)
  })
})
