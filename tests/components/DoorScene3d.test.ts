// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import DoorScene from '@/components/DoorScene.vue'
import Door3D from '@/components/doors3d/Door3D.vue'
import { doors } from '@/content/scenes'
import { doorLooks } from '@/engine/doorLook'
import { useQualityStore } from '@/stores/quality'
import { door3dFailed, resetDoor3dSession } from '@/effects/door3dSession'
import type { KnockHit } from '@/audio/sfx'

// Pas d’audio réel ni de GPU : le canevas de la porte 3D est remplacé par un composant inerte (ses props sont lues par les tests).
vi.mock('@/audio/sfx', () => ({
  creak: vi.fn(),
  knock: vi.fn(),
  slam: vi.fn(),
  unlock: vi.fn(),
  scheduleKnocks: vi.fn((_o: number[], _i: number, _h: KnockHit) => ({ times: [], now: () => 0, cancel: vi.fn() })),
}))
vi.mock('@/components/doors3d/Door3D.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'Door3D',
      props: {
        variant: { type: String, default: '' },
        angle: { type: Number, default: 0 },
        lean: { type: Number, default: 0 },
        knock: { type: Number, default: 0 },
        knockIntensity: { type: Number, default: 0 },
        shadows: { type: Boolean, default: true },
        reduced: { type: Boolean, default: false },
        interior: { type: Number, default: 1 },
        mist: { type: Number, default: 1 },
        quality: { type: String, default: 'high' },
      },
      emits: ['failed', 'ready'],
      setup: (p) => () => h('canvas', { 'data-variant': p.variant }),
    }),
  }
})
// Les animations Motion sont remplacées par des contrôles inertes qui gardent leurs arguments.
const anim = vi.hoisted(() => ({ calls: [] as unknown[][] }))
vi.mock('motion-v', async (orig) => ({
  ...(await orig<typeof import('motion-v')>()),
  animate: vi.fn((...args: unknown[]) => {
    anim.calls.push(args)
    return { stop: () => {} }
  }),
}))

let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.useFakeTimers()
  anim.calls.length = 0
  setActivePinia(createPinia())
  resetDoor3dSession()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

const porte = (id: string) => doors.find((d) => d.id === id)!
const monter = (id: string, props: Record<string, unknown> = {}) => {
  wrapper = mount(DoorScene, { props: { door: porte(id), line: 'Entrez.', level: 1, ...props }, attachTo: document.body, global: { plugins: [createPinia()] } })
  return wrapper
}
/** Première image de la porte 3D dessinée : la porte apparaît (fondu) et devient cognable. */
const prete = async (w: VueWrapper) => {
  w.findComponent(Door3D).vm.$emit('ready')
  await nextTick()
  await vi.advanceTimersByTimeAsync(350)
}
const bouton = (w: VueWrapper) => w.get('button[aria-label="Cogner à la porte"]')

describe('DoorScene : porte 3D des lieux', () => {
  it.each(doors.filter((d) => d.place).map((d) => [d.id, d.place]))('%s : le canevas 3D du lieu remplace le SVG, le bouton reste par-dessus', async (id, place) => {
    const w = monter(id as string)
    await prete(w)
    expect(w.findComponent(Door3D).props('variant')).toBe(place)
    expect(w.find('.door-base').exists()).toBe(false)
    expect(w.findAll('[role="img"]')).toHaveLength(1)
    expect(w.get('[role="img"]').attributes('aria-label')).toBe(porte(id as string).label)
    expect(bouton(w).attributes('aria-label')).toBe('Cogner à la porte')
    // Le bouton suit le canevas dans l’ordre du DOM et porte z-3 : il reçoit les touchers.
    expect(bouton(w).classes()).toContain('z-3')
  })

  it.each(['frigo', 'garde-robe'])('%s (porte rare) reste en SVG', (id) => {
    const w = monter(id)
    expect(w.findComponent(Door3D).exists()).toBe(false)
    expect(w.find('.door-base').exists()).toBe(true)
  })

  it('un échec du GPU rend la porte au SVG, sans toucher au bouton', async () => {
    const w = monter('perron')
    const bouton0 = bouton(w).element
    w.findComponent(Door3D).vm.$emit('failed')
    await nextTick()
    expect(w.findComponent(Door3D).exists()).toBe(false)
    expect(w.find('.door-base').exists()).toBe(true)
    expect(bouton(w).element).toBe(bouton0)
    expect(bouton(w).attributes('aria-disabled')).toBeUndefined()
  })

  it('le premier échec vaut pour toute la session : la porte de lieu suivante est directement en SVG', async () => {
    const w = monter('perron')
    w.findComponent(Door3D).vm.$emit('failed')
    await nextTick()
    expect(door3dFailed.value).toBe(true)
    w.unmount()
    const suivante = monter('maison')
    expect(suivante.findComponent(Door3D).exists()).toBe(false)
    expect(suivante.find('.door-base').exists()).toBe(true)
    expect(bouton(suivante).attributes('aria-disabled')).toBeUndefined()
  })

  it('le SVG de repli est cognable et ouvre la porte (poignées préparées après coup)', async () => {
    const w = monter('perron', { quick: true })
    w.findComponent(Door3D).vm.$emit('failed')
    await nextTick()
    await bouton(w).trigger('click')
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.emitted('open')).toBeTruthy()
  })

  it('niveau de qualité `low` : la porte reste en 3D (ombres coupées, niveau transmis pour le DPR minimal)', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useQualityStore().level = 'low'
    wrapper = mount(DoorScene, { props: { door: porte('perron'), line: 'Entrez.', level: 1 }, attachTo: document.body, global: { plugins: [pinia] } })
    const d = wrapper.findComponent(Door3D)
    expect(d.exists()).toBe(true)
    expect(d.props('shadows')).toBe(false)
    expect(d.props('quality')).toBe(useQualityStore().settled)
    expect(wrapper.find('.door-base').exists()).toBe(false)
  })

  it('porte rare en `low` : pas de filtre non plus ; en `high`, le filtre de relief reste', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useQualityStore().level = 'low'
    wrapper = mount(DoorScene, { props: { door: porte('frigo'), line: 'Entrez.', level: 1 }, attachTo: document.body, global: { plugins: [pinia] } })
    expect(wrapper.find('filter').exists()).toBe(false)
    wrapper.unmount()
    const haut = createPinia()
    setActivePinia(haut)
    useQualityStore().level = 'high'
    wrapper = mount(DoorScene, { props: { door: porte('frigo'), line: 'Entrez.', level: 1 }, attachTo: document.body, global: { plugins: [haut] } })
    expect(wrapper.find('filter').exists()).toBe(true)
  })

  it('le niveau change en pleine visite : la porte garde son rendu jusqu’au prochain montage', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useQualityStore().level = 'high'
    wrapper = mount(DoorScene, { props: { door: porte('garde-robe'), line: 'Entrez.', level: 1 }, attachTo: document.body, global: { plugins: [pinia] } })
    useQualityStore().level = 'low'
    await nextTick()
    expect(wrapper.find('filter').exists()).toBe(true)
  })

  it('ombres de la porte 3D : seulement au niveau `high`', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useQualityStore().level = 'medium'
    wrapper = mount(DoorScene, { props: { door: porte('perron'), line: 'Entrez.', level: 1 }, attachTo: document.body, global: { plugins: [pinia] } })
    expect(wrapper.findComponent(Door3D).props('shadows')).toBe(false)
  })

  it('chaque coup du joueur pousse le ressort du battant (compteur `knock`)', async () => {
    const w = monter('perron')
    await prete(w)
    const avant = w.findComponent(Door3D).props('knock') as number
    await bouton(w).trigger('click')
    expect(w.findComponent(Door3D).props('knock')).toBeGreaterThan(avant)
  })

  it('l’ouverture pivote par la valeur Motion de l’angle (seul maître du pivot), pas par un transform', async () => {
    const r = mount(DoorScene, { props: { door: porte('perron'), line: 'Entrez.', level: 1, quick: true }, attachTo: document.body, global: { plugins: [createPinia()] } })
    wrapper = r
    await prete(r)
    await bouton(r).trigger('click')
    await vi.advanceTimersByTimeAsync(500)
    const pivot = anim.calls.find((c) => Array.isArray(c[1]) && (c[1] as number[]).includes(72))
    expect(pivot).toBeTruthy()
    expect(typeof (pivot![0] as { get: () => number }).get).toBe('function') // une valeur Motion, pas un élément
    expect(pivot![1]).toEqual([0, -2.5, 72])
    expect(r.findAll('[data-leaf]')).toHaveLength(1)
  })
})

describe('DoorScene : attente de la porte 3D (aucun SVG avant `ready`)', () => {
  const svgVisible = (w: VueWrapper) => w.find('.door-base').exists()

  it('avant la première image : aucun SVG de porte, le canevas est monté mais invisible et non annoncé', () => {
    const w = monter('perron')
    expect(svgVisible(w)).toBe(false)
    expect(w.findComponent(Door3D).exists()).toBe(true)
    expect(w.get('canvas').element.parentElement!.className).toContain('opacity-0')
    expect(w.findAll('[role="img"]')).toHaveLength(0)
  })

  it('avant `ready` : le bouton est `aria-disabled` et la scène annonce que la porte se prépare', async () => {
    const w = monter('perron')
    await nextTick()
    expect(bouton(w).attributes('aria-disabled')).toBe('true')
    expect(w.get('[role="status"]').text()).toBe('La porte se prépare…')
    const focusAvant = document.activeElement
    await prete(w)
    expect(bouton(w).attributes('aria-disabled')).toBeUndefined()
    expect(w.get('[role="status"]').text()).toBe('La porte est prête.')
    expect(document.activeElement).toBe(focusAvant)
  })

  it('à `ready` : la porte apparaît en fondu, sans que le SVG paraisse jamais', async () => {
    const w = monter('perron')
    w.findComponent(Door3D).vm.$emit('ready')
    await nextTick()
    expect(svgVisible(w)).toBe(false)
    expect(w.get('canvas').element.parentElement!.className).toContain('opacity-100')
    expect(w.findAll('[data-leaf]')).toHaveLength(1)
    expect(w.get('[role="img"]').attributes('aria-label')).toBe(porte('perron').label)
  })

  it('cogner avant `ready` ne fait rien (ni coup, ni suite), et le `ready` tardif n’a rien manqué', async () => {
    const w = monter('perron')
    await bouton(w).trigger('click')
    await bouton(w).trigger('pointerdown', { pointerType: 'touch' })
    await vi.advanceTimersByTimeAsync(1500)
    expect(w.findComponent(Door3D).props('knock')).toBe(0)
    expect(w.get('[role="status"]').text()).toBe('La porte se prépare…')
    expect(svgVisible(w)).toBe(false)
    await prete(w)
    await bouton(w).trigger('click')
    expect(w.findComponent(Door3D).props('knock')).toBeGreaterThan(0)
  })

  it('une ouverture rapide (quick) avant `ready` ne fait rien non plus', async () => {
    const w = monter('perron', { quick: true })
    await bouton(w).trigger('click')
    await vi.advanceTimersByTimeAsync(1500)
    expect(w.emitted('open')).toBeUndefined()
    expect(svgVisible(w)).toBe(false)
  })

  it('porte rare (frigo) : jamais en attente, bouton actif', () => {
    const w = monter('frigo')
    expect(bouton(w).attributes('aria-disabled')).toBeUndefined()
  })

  it('fermeture (porte qui claque) : attend la première image avant d’animer', async () => {
    const w = monter('perron', { closing: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(anim.calls.some((c) => Array.isArray(c[1]) && (c[1] as number[]).includes(72))).toBe(false)
    expect(w.emitted('closed')).toBeUndefined()
    await prete(w)
    await vi.advanceTimersByTimeAsync(1500)
    expect(w.emitted('closed')).toBeTruthy()
  })

  it('le GPU est perdu PENDANT l’ouverture : la porte 3D reste, pas de battant SVG fermé en plein zoom', async () => {
    const w = monter('perron', { quick: true })
    await prete(w)
    await bouton(w).trigger('click')
    await vi.advanceTimersByTimeAsync(500)
    expect(anim.calls.some((c) => Array.isArray(c[1]) && (c[1] as number[]).includes(72))).toBe(true) // l’ouverture est en cours
    w.findComponent(Door3D).vm.$emit('failed')
    await nextTick()
    await vi.advanceTimersByTimeAsync(50)
    expect(w.findComponent(Door3D).exists()).toBe(true)
    expect(svgVisible(w)).toBe(false)
  })

  it('le GPU échoue en idle après la première image : retour au SVG', async () => {
    const w = monter('perron')
    await prete(w)
    w.findComponent(Door3D).vm.$emit('failed')
    await nextTick()
    expect(w.findComponent(Door3D).exists()).toBe(false)
    expect(svgVisible(w)).toBe(true)
  })

  it('le niveau posé est transmis à la porte 3D', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useQualityStore().level = 'medium'
    wrapper = mount(DoorScene, { props: { door: porte('perron'), line: 'Entrez.', level: 1 }, attachTo: document.body, global: { plugins: [pinia] } })
    expect(wrapper.findComponent(Door3D).props('quality')).toBe(useQualityStore().settled)
  })
})

describe('DoorScene : garde-robe à deux battants', () => {
  it('deux battants miroirs : gonds à l’extérieur, un seul rôle image, une seule porte annoncée', () => {
    const w = monter('garde-robe')
    const battants = w.findAll('[data-leaf]')
    expect(battants.map((b) => b.attributes('data-side')).sort()).toEqual(['l', 'r'])
    const [g, d] = ['l', 'r'].map((s) => w.get(`[data-leaf][data-side="${s}"]`))
    expect((g.element as HTMLElement).style.transformOrigin).toBe('3.3333333333333335% 50%')
    expect((d.element as HTMLElement).style.transformOrigin).toBe('96.66666666666667% 50%')
    expect(w.findAll('[role="img"]')).toHaveLength(1)
    expect(d.attributes('aria-hidden')).toBe('true')
    // Chaque moitié est découpée dans son propre côté (débord permis à l’extérieur).
    expect(g.find('.backface-hidden').attributes('style')).toContain('inset(-12% 49.7% -12% -12%)')
    expect(d.find('.backface-hidden').attributes('style')).toContain('inset(-12% -12% -12% 49.7%)')
    // Chant au centre, replié en miroir.
    expect(g.html()).toContain('rotateY(90deg)')
    expect(d.html()).toContain('rotateY(-90deg)')
  })

  it('l’ouverture fait pivoter les deux battants en sens inverse (rotateY positif à gauche, négatif à droite)', async () => {
    const w = monter('garde-robe', { quick: true })
    await bouton(w).trigger('click')
    await vi.advanceTimersByTimeAsync(500)
    const pivots = anim.calls.filter((c) => (c[1] as { rotateY?: number[] }).rotateY?.includes?.(72) || (c[1] as { rotateY?: number[] }).rotateY?.includes?.(-72))
    const valeurs = pivots.map((c) => (c[1] as { rotateY: number[] }).rotateY)
    expect(valeurs).toContainEqual([0, -2.5, 72])
    expect(valeurs).toContainEqual([-0, 2.5, -72])
  })

  it('une seule porte double : aucune autre porte n’a de `leaves`', () => {
    expect(
      Object.entries(doorLooks)
        .filter(([, l]) => l.leaves)
        .map(([id]) => id),
    ).toEqual(['garde-robe'])
    const l = doorLooks['garde-robe'].leaves!
    expect(l[0].hingeX).toBeLessThan(l[0].edgeX)
    expect(l[1].hingeX).toBeGreaterThan(l[1].edgeX)
    expect(l[0].edgeX).toBe(l[1].edgeX) // les deux chants se rejoignent au centre
  })
})
