// @vitest-environment happy-dom
import './horlogeGlobale'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { animate } from 'motion-v'
import WindowsActivity from '@/components/activities/WindowsActivity.vue'
import { ACTIVITY_PROMPTS } from '@/content/activityPrompts'
import { ACTIVITY_GRACE_MS, OUTCOME_MS, durationOf } from '@/engine/activityTiming'
import { knock } from '@/audio/sfx'
import { avancer, fenetrePerdFocus, fenetreRetrouveFocus, horloge, mouvementReduit, reprendre } from './aide'

// happy-dom annule mal les animations natives (AbortError non gérée) : `animate` est remplacé (et sert à observer la secousse).
vi.mock('motion-v', async (importOriginal) => ({ ...(await importOriginal<typeof import('motion-v')>()), animate: vi.fn(() => ({ stop: () => {}, finished: Promise.resolve() })) }))
vi.mock('@/audio/sfx', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/audio/sfx')>()), knock: vi.fn() }))
// Aléa déterministe : l’ordre des fenêtres est fixe.
vi.mock('@/engine/rng', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/engine/rng')>()
  return { ...orig, secureRng: () => orig.mulberry32(3) }
})

let wrapper: VueWrapper | undefined
let avertissements: ReturnType<typeof vi.spyOn>[] = []
beforeEach(() => {
  horloge()
  vi.mocked(knock).mockClear()
  vi.mocked(animate).mockClear()
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

const monter = async (level = 1) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(WindowsActivity, { props: { level }, attachTo: document.body, global: { plugins: [pinia] } })
  await avancer(1)
  return wrapper
}
const fenetres = (w: VueWrapper) => w.findAll('button[aria-label^="Fenêtre"]')
const allumee = (w: VueWrapper) => fenetres(w).findIndex((f) => f.classes().includes('bg-amber-300'))
const indice = (w: VueWrapper) => fenetres(w).findIndex((f) => f.classes().includes('bg-amber-900/50'))
const hud = (w: VueWrapper) => w.get('[data-testid="activity-hud"]')
const statut = (w: VueWrapper) => w.get('p[role="status"][aria-live="polite"]')
const consigne = (w: VueWrapper) => w.get('p[aria-hidden="true"]')
const barre = (w: VueWrapper) => Number(w.get('[role="progressbar"]').attributes('aria-valuenow'))
// L’ordre à reproduire est annoncé au tour du joueur : « À vous : fenêtres 4, 5, 3. »
const sequence = (w: VueWrapper) =>
  /fenêtres ([\d, ]+)\./
    .exec(statut(w).text())![1]
    .split(', ')
    .map((n) => Number(n) - 1)

// Joue la démonstration (intro 700 ms puis trois fenêtres de 1,05 s) et relève l’ordre des fenêtres allumées.
const regarderDemo = async (w: VueWrapper) => {
  const vues: number[] = []
  for (let t = 0; t < 6000 && !consigne(w).text().startsWith('À vous'); t += 25) {
    await avancer(25)
    const a = allumee(w)
    if (a >= 0 && vues.at(-1) !== a) vues.push(a)
  }
  await avancer(200)
  return vues
}

describe('WindowsActivity : démonstration', () => {
  it('au départ, la consigne dit de regarder et les fenêtres sont inertes', async () => {
    const w = await monter()
    await avancer(200)
    expect(consigne(w).text()).toBe('Regardez bien l’ordre des fenêtres…')
    expect(statut(w).text()).toBe('Regardez bien…')
    expect(fenetres(w)).toHaveLength(6)
    for (const f of fenetres(w)) expect(f.attributes('aria-disabled')).toBe('true')
    // Un clic pendant la démonstration est ignoré.
    await fenetres(w)[0].trigger('click')
    expect(knock).not.toHaveBeenCalled()
  })

  it('les trois fenêtres de l’ordre s’allument tour à tour, puis c’est au joueur', async () => {
    const w = await monter()
    const vues = await regarderDemo(w)
    expect(consigne(w).text()).toBe('À vous ! Frappez dans le même ordre.')
    expect(vues).toEqual(sequence(w))
    expect(vues).toHaveLength(3)
    expect(new Set(vues).size).toBe(3)
    for (const f of fenetres(w)) expect(f.attributes('aria-disabled')).toBe('false')
  })

  it('la minuterie ne coule pas pendant la démonstration, puis reprend au tour du joueur', async () => {
    const w = await monter()
    await avancer(3000)
    expect(barre(w)).toBe(100)
    await regarderDemo(w)
    await avancer(4000)
    expect(barre(w)).toBeLessThan(100)
  })
})

describe('WindowsActivity : saisie', () => {
  it('l’ordre exact réussit : coups sonores, issue puis fin émise ; les fenêtres se verrouillent', async () => {
    const w = await monter()
    await regarderDemo(w)
    const ordre = sequence(w)
    for (const [n, i] of ordre.entries()) {
      await fenetres(w)[i].trigger('click')
      expect(knock).toHaveBeenCalledTimes(n + 1)
    }
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.windows.win)
    expect(w.emitted('done')).toBeUndefined()
    // Verrouillé : un clic de plus ne frappe plus.
    await fenetres(w)[0].trigger('click')
    expect(knock).toHaveBeenCalledTimes(3)
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('la fenêtre cliquée s’allume brièvement (450 ms)', async () => {
    const w = await monter()
    await regarderDemo(w)
    const [premiere] = sequence(w)
    await fenetres(w)[premiere].trigger('click')
    expect(allumee(w)).toBe(premiere)
    await avancer(500)
    expect(allumee(w)).toBe(-1)
  })

  it('la dernière fenêtre de l’ordre s’allume aussi, malgré la réussite immédiate', async () => {
    const w = await monter()
    await regarderDemo(w)
    const ordre = sequence(w)
    for (const i of ordre) await fenetres(w)[i].trigger('click')
    expect(allumee(w)).toBe(ordre.at(-1))
    await avancer(500)
    expect(allumee(w)).toBe(-1)
  })

  it('une faute secoue la maison, verrouille la saisie et rejoue la démonstration', async () => {
    const w = await monter()
    await regarderDemo(w)
    const ordre = sequence(w)
    const faux = [0, 1, 2, 3, 4, 5].find((i) => i !== ordre[0])!
    await fenetres(w)[faux].trigger('click')
    expect(consigne(w).text()).toBe('Ce n’était pas celle-là. Regardez encore…')
    expect(knock).not.toHaveBeenCalled()
    expect(animate).toHaveBeenCalledWith(expect.anything(), { x: [-12, 0] }, expect.objectContaining({ type: 'spring' }))
    // Pendant le rejeu, les fenêtres sont inertes ; la démonstration reprend.
    await fenetres(w)[ordre[0]].trigger('click')
    expect(knock).not.toHaveBeenCalled()
    const vues = await regarderDemo(w)
    expect(vues).toEqual(ordre)
    expect(consigne(w).text()).toBe('À vous ! Frappez dans le même ordre.')
    // La saisie repart du début de l’ordre.
    for (const i of ordre) await fenetres(w)[i].trigger('click')
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.windows.win)
  })

  it('une faute au milieu de l’ordre le recommence du début', async () => {
    const w = await monter()
    await regarderDemo(w)
    const ordre = sequence(w)
    await fenetres(w)[ordre[0]].trigger('click')
    const faux = [0, 1, 2, 3, 4, 5].find((i) => i !== ordre[1])!
    await fenetres(w)[faux].trigger('click')
    expect(knock).toHaveBeenCalledTimes(1)
    await regarderDemo(w)
    // Une seule bonne fenêtre ne suffit plus : il faut tout refaire.
    await fenetres(w)[ordre[1]].trigger('click')
    expect(consigne(w).text()).toBe('Ce n’était pas celle-là. Regardez encore…')
  })

  it('après deux fautes, la prochaine fenêtre attendue reste faiblement marquée', async () => {
    const w = await monter()
    await regarderDemo(w)
    const ordre = sequence(w)
    const faux = [0, 1, 2, 3, 4, 5].find((i) => i !== ordre[0])!
    expect(indice(w)).toBe(-1)
    for (let n = 0; n < 2; n++) {
      await fenetres(w)[faux].trigger('click')
      await regarderDemo(w)
    }
    expect(indice(w)).toBe(ordre[0])
    await fenetres(w)[ordre[0]].trigger('click')
    await avancer(500)
    expect(indice(w)).toBe(ordre[1])
  })

  it('mouvement réduit : la faute ne secoue pas la maison', async () => {
    mouvementReduit(true)
    const w = await monter()
    await regarderDemo(w)
    const ordre = sequence(w)
    const faux = [0, 1, 2, 3, 4, 5].find((i) => i !== ordre[0])!
    await fenetres(w)[faux].trigger('click')
    expect(consigne(w).text()).toContain('Ce n’était pas celle-là')
    expect(animate).not.toHaveBeenCalledWith(expect.anything(), { x: [-12, 0] }, expect.anything())
  })
})

describe('WindowsActivity : issue', () => {
  it('sans saisie, l’échec arrive à la fin du temps de jeu (la démonstration en est exclue)', async () => {
    const w = await monter()
    await regarderDemo(w)
    await avancer(durationOf('windows') + ACTIVITY_GRACE_MS + 200)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.windows.fail)
    expect(statut(w).text()).toBe('')
    // Fenêtres verrouillées après l’échec.
    await fenetres(w)[0].trigger('click')
    expect(knock).not.toHaveBeenCalled()
    await avancer(OUTCOME_MS + 50)
    expect(w.emitted('done')).toHaveLength(1)
  })
})

describe('WindowsActivity : pause', () => {
  it('pendant la démonstration, la pause suspend les fenêtres et la reprise remontre celle en cours', async () => {
    const w = await monter()
    await avancer(900) // intro + première fenêtre allumée
    expect(allumee(w)).toBeGreaterThanOrEqual(0)
    fenetrePerdFocus()
    await avancer(50)
    expect(allumee(w)).toBe(-1)
    expect(w.text()).toContain('EN PAUSE')
    await avancer(10_000)
    expect(allumee(w)).toBe(-1)
    expect(consigne(w).text()).toContain('Regardez')
    fenetreRetrouveFocus()
    await avancer(3000)
    expect(consigne(w).text()).toContain('Regardez') // le retour du focus seul ne reprend pas
    await reprendre(w)
    const vues = await regarderDemo(w)
    expect(vues).toHaveLength(3)
    expect(vues).toEqual(sequence(w))
  })

  it('pause avant la fin de l’introduction : la démonstration ne démarre qu’à la reprise', async () => {
    const w = await monter()
    await avancer(100)
    fenetrePerdFocus()
    await avancer(5000)
    expect(allumee(w)).toBe(-1)
    expect(consigne(w).text()).toContain('Regardez')
    await reprendre(w)
    const vues = await regarderDemo(w)
    expect(vues).toHaveLength(3)
  })

  it('pause pendant la saisie : le temps est figé, aucun échec', async () => {
    const w = await monter()
    await regarderDemo(w)
    fenetrePerdFocus()
    await avancer(40_000)
    expect(hud(w).text()).not.toContain(ACTIVITY_PROMPTS.windows.fail)
    await reprendre(w)
    await avancer(durationOf('windows') + ACTIVITY_GRACE_MS)
    expect(hud(w).text()).toContain(ACTIVITY_PROMPTS.windows.fail)
  })

  it('pause sans démonstration en cours : rien n’est repris à tort', async () => {
    const w = await monter()
    await regarderDemo(w)
    fenetrePerdFocus()
    await avancer(100)
    await reprendre(w)
    await avancer(3000)
    expect(consigne(w).text()).toContain('À vous')
  })
})
