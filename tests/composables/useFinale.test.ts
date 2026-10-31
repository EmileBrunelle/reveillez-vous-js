// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, shallowRef } from 'vue'

const ro = vi.hoisted(() => ({ cb: null as null | (() => void) }))
vi.mock('@vueuse/core', async (orig) => ({
  ...(await orig<typeof import('@vueuse/core')>()),
  useResizeObserver: (_t: unknown, cb: () => void) => {
    ro.cb = cb
  },
}))
// `animate` simulé : renvoie des contrôles terminables, et enregistre cible, valeurs et options.
const anim = vi.hoisted(() => ({ calls: [] as { target: unknown; to: unknown; opts: Record<string, unknown>; stop: ReturnType<typeof vi.fn>; finish: () => void }[] }))
vi.mock('motion-v', async (orig) => ({
  ...(await orig<typeof import('motion-v')>()),
  animate: (target: unknown, to: unknown, opts: Record<string, unknown>) => {
    let finish = () => {}
    const done = new Promise<void>((r) => (finish = r))
    const c = { target, to, opts, stop: vi.fn(), finish, then: done.then.bind(done) }
    anim.calls.push(c)
    return c
  },
}))
import { useFinaleBox } from '@/composables/useFinaleBox'
import { useRiseDirective, useTextLeave } from '@/composables/useFinaleRise'

beforeEach(() => {
  anim.calls.length = 0
  ro.cb = null
})

describe('useFinaleBox', () => {
  const mount = (flags: { reduced?: boolean; skipped?: boolean } = {}) => {
    const el = { offsetHeight: 120 }
    const inner = shallowRef(el as HTMLElement)
    const reduced = ref(flags.reduced ?? false)
    const skipped = ref(flags.skipped ?? false)
    const keep = vi.fn()
    const scope = effectScope()
    const box = scope.run(() => useFinaleBox(inner, { reduced, skipped }, keep))!
    return { el, inner, reduced, skipped, keep, box, scope }
  }

  it('contenu sans hauteur : rien ne bouge', () => {
    const { el, box, keep } = mount()
    el.offsetHeight = 0
    ro.cb!()
    expect(box.height.get()).toBe(0)
    expect(keep).not.toHaveBeenCalled()
  })

  it('première mesure : hauteur posée, entrée sur ressort (échelle 0,94, y 14) retenue par `keep`', () => {
    const { box, keep } = mount()
    ro.cb!()
    expect(box.height.get()).toBe(120)
    expect(box.scale.get()).toBe(0.94)
    expect(box.y.get()).toBe(14)
    expect(anim.calls).toHaveLength(3)
    expect(anim.calls.map((c) => c.to)).toEqual([1, 1, 0])
    for (const c of anim.calls) expect(c.opts).toMatchObject({ type: 'spring', stiffness: 70, damping: 16 })
    expect(keep).toHaveBeenCalledTimes(3)
  })

  it('après un saut (skipped) : visible tout de suite, aucune animation', () => {
    const { box, keep } = mount({ skipped: true })
    ro.cb!()
    expect(box.opacity.get()).toBe(1)
    expect(box.scale.get()).toBe(1)
    expect(anim.calls).toHaveLength(0)
    expect(keep).not.toHaveBeenCalled()
  })

  it('mouvement réduit : simple fondu de 0,6 s, sans échelle ni déplacement', () => {
    const { box, keep } = mount({ reduced: true })
    ro.cb!()
    expect(anim.calls).toHaveLength(1)
    expect(anim.calls[0]!.opts).toMatchObject({ duration: 0.6, ease: 'easeOut' })
    expect(box.scale.get()).toBe(1)
    expect(keep).toHaveBeenCalledOnce()
  })

  it('le contenu grandit : la hauteur suit sur un ressort et la précédente est arrêtée', () => {
    const { el, box, keep } = mount()
    ro.cb!()
    anim.calls.length = 0
    el.offsetHeight = 200
    ro.cb!()
    expect(anim.calls).toHaveLength(1)
    expect(anim.calls[0]!.to).toBe(200)
    expect(anim.calls[0]!.opts).toMatchObject({ type: 'spring', stiffness: 90, damping: 20 })
    el.offsetHeight = 260
    ro.cb!()
    expect(anim.calls[0]!.stop).toHaveBeenCalledOnce()
    expect(anim.calls).toHaveLength(2)
    expect(keep).toHaveBeenLastCalledWith(anim.calls[1])
    expect(box.height.get()).toBe(120) // seul le ressort la fait bouger
  })

  it('mouvement réduit ou saut : la hauteur est posée directement', () => {
    const a = mount({ reduced: true })
    ro.cb!()
    anim.calls.length = 0
    a.el.offsetHeight = 300
    ro.cb!()
    expect(a.box.height.get()).toBe(300)
    expect(anim.calls).toHaveLength(0)
    const b = mount({ skipped: true })
    ro.cb!()
    b.el.offsetHeight = 310
    ro.cb!()
    expect(b.box.height.get()).toBe(310)
  })
})

describe('useRiseDirective (v-rise)', () => {
  const make = (flags: { reduced?: boolean; skipped?: boolean } = {}) => {
    const keep = vi.fn()
    const dir = useRiseDirective({ reduced: ref(flags.reduced ?? false), skipped: ref(flags.skipped ?? false) }, keep)
    const el = document.createElement('p')
    return { keep, dir, el }
  }
  const call = (dir: ReturnType<typeof useRiseDirective>, hook: 'beforeMount' | 'mounted', el: HTMLElement, value: object = {}) => (dir[hook] as (...a: unknown[]) => void)(el, { value })

  it('beforeMount : invisible d’emblée (pas de flash avant le ressort)', () => {
    const { dir, el } = make()
    call(dir, 'beforeMount', el)
    expect(el.style.opacity).toBe('0')
  })

  it('mouvement réduit ou saut : l’élément reste visible et rien n’est animé', () => {
    for (const flags of [{ reduced: true }, { skipped: true }]) {
      const { dir, el, keep } = make(flags)
      call(dir, 'beforeMount', el)
      call(dir, 'mounted', el)
      expect(el.style.opacity).toBe('')
      expect(anim.calls).toHaveLength(0)
      expect(keep).not.toHaveBeenCalled()
    }
  })

  it('monte : y de 16 px par défaut, ressort normal, délai `d`', () => {
    const { dir, el, keep } = make()
    call(dir, 'mounted', el, { d: 1.5 })
    const c = anim.calls[0]!
    expect(c.target).toBe(el)
    expect(c.to).toEqual({ opacity: [0, 1], y: [16, 0] })
    expect(c.opts).toMatchObject({ type: 'spring', stiffness: 80, damping: 17, delay: 1.5 })
    expect(keep).toHaveBeenCalledWith(c)
  })

  it('lettre (ressort vif), doux (ressort lent), y personnalisé ou nul', () => {
    const { dir, el } = make()
    call(dir, 'mounted', el, { letter: true })
    expect(anim.calls[0]!.opts).toMatchObject({ stiffness: 240, damping: 15, delay: 0 })
    call(dir, 'mounted', el, { soft: true, y: 30 })
    expect(anim.calls[1]!.opts).toMatchObject({ stiffness: 36, damping: 13 })
    expect(anim.calls[1]!.to).toEqual({ opacity: [0, 1], y: [30, 0] })
    call(dir, 'mounted', el, { y: 0 })
    expect(anim.calls[2]!.to).toEqual({ opacity: [0, 1] })
  })
})

describe('useTextLeave', () => {
  const flush = async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve()
  }
  const make = (flags: { reduced?: boolean; skipped?: boolean } = {}) => useTextLeave({ reduced: ref(flags.reduced ?? false), skipped: ref(flags.skipped ?? false) })

  it('mouvement réduit ou saut : `done` tout de suite, sans animer', () => {
    for (const flags of [{ reduced: true }, { skipped: true }]) {
      const { leaveText } = make(flags)
      const done = vi.fn()
      leaveText(document.createElement('p'), done)
      expect(done).toHaveBeenCalledOnce()
      expect(anim.calls).toHaveLength(0)
    }
  })

  it('fondu de sortie de 0,45 s ; `done` à la fin de l’animation', async () => {
    const { leaveText } = make()
    const done = vi.fn()
    leaveText(document.createElement('p'), done)
    expect(anim.calls[0]!.opts).toMatchObject({ duration: 0.45, ease: 'easeIn' })
    expect(anim.calls[0]!.to).toEqual({ opacity: 0 })
    expect(done).not.toHaveBeenCalled()
    anim.calls[0]!.finish()
    await flush()
    expect(done).toHaveBeenCalledOnce()
  })

  it('finishLeaving mène la sortie à sa fin tout de suite ; sans sortie en cours, ne fait rien', () => {
    const { leaveText, finishLeaving } = make()
    expect(() => finishLeaving()).not.toThrow()
    const done = vi.fn()
    leaveText(document.createElement('p'), done)
    finishLeaving()
    expect(done).toHaveBeenCalledOnce()
    expect(anim.calls[0]!.stop).toHaveBeenCalledOnce() // l’animation est menée à sa fin puis libérée
    finishLeaving() // plus de sortie en cours : sans effet
    expect(done).toHaveBeenCalledOnce()
  })
})
