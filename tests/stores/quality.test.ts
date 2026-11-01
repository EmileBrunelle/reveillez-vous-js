import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { COOLDOWN_MS } from '@/effects/frameJudge'
import { cutShadowsForSession, resetShadowVerdict, shadowsCutForSession } from '@/effects/shadowQuality'
import { forcedLevel, startLevel, useQuality, useQualityStore } from '@/stores/quality'

/** Magasin neuf, départ `high` (aucune API d’appareil dans l’environnement node simulé). */
const fresh = (env: { coarse?: boolean; cores?: number; memory?: number } = {}) => {
  vi.stubGlobal('matchMedia', () => ({ matches: !!env.coarse }))
  vi.stubGlobal('navigator', { hardwareConcurrency: env.cores ?? 8, deviceMemory: env.memory })
  setActivePinia(createPinia())
  return useQualityStore()
}

/** Pousse des images de `ms` ms à partir de `t0` pendant `durationMs` ; renvoie l’instant atteint. */
const feed = (q: ReturnType<typeof useQualityStore>, t0: number, durationMs: number, ms: number) => {
  let t = t0
  while (t < t0 + durationMs) {
    t += ms
    q.sample(ms, t)
  }
  return t
}

beforeEach(() => {
  resetShadowVerdict()
  vi.unstubAllGlobals()
})

describe('niveau de départ', () => {
  it('high sur ordinateur, medium au toucher ou sous 641 px, low sur appareil modeste', () => {
    expect(startLevel({ coarseOrNarrow: false })).toBe('high')
    expect(startLevel({ coarseOrNarrow: true })).toBe('medium')
    expect(startLevel({ coarseOrNarrow: false, cores: 2 })).toBe('low')
    expect(startLevel({ coarseOrNarrow: false, memory: 1 })).toBe('low')
    expect(startLevel({ coarseOrNarrow: true, cores: 8, memory: 8 })).toBe('medium')
  })

  it('API absentes ou valeurs nulles : on ne descend pas', () => {
    expect(startLevel({ coarseOrNarrow: false, cores: undefined, memory: undefined })).toBe('high')
    expect(startLevel({ coarseOrNarrow: false, cores: 0, memory: 0 })).toBe('high')
  })

  it('le magasin lit l’appareil (pointeur grossier) et tolère l’absence de matchMedia et de navigator', () => {
    expect(fresh({ coarse: true }).level).toBe('medium')
    expect(fresh({ cores: 2 }).level).toBe('low')
    vi.stubGlobal('matchMedia', undefined)
    vi.stubGlobal('navigator', undefined)
    setActivePinia(createPinia())
    expect(useQualityStore().level).toBe('high')
  })

  it('?quality= ne force que des niveaux valides', () => {
    expect(forcedLevel('?quality=low')).toBe('low')
    expect(forcedLevel('?x=1&quality=medium')).toBe('medium')
    expect(forcedLevel('?quality=ultra')).toBeNull()
    expect(forcedLevel('')).toBeNull()
  })

  it('en développement, ?quality=low fige le niveau : le gouverneur est muet', () => {
    vi.stubGlobal('location', { search: '?quality=low' })
    const q = fresh()
    expect(q.level).toBe('low')
    expect(q.forced).toBe(true)
    feed(q, 0, 10_000, 8)
    q.transition(20_000)
    expect(q.level).toBe('low')
  })
})

describe('API simple', () => {
  it('useQuality : level et atLeast', () => {
    fresh({ coarse: true })
    const { level, atLeast } = useQuality()
    expect(level.value).toBe('medium')
    expect(atLeast('medium')).toBe(true)
    expect(atLeast('high')).toBe(false)
    expect(atLeast('low')).toBe(true)
  })
})

describe('descente', () => {
  it('descend d’un niveau quand la moyenne dépasse ~22 ms, immédiatement, et pas plus d’un niveau par période de silence', () => {
    const q = fresh()
    const t = feed(q, 2000, 3000, 35)
    expect(q.level).toBe('medium')
    feed(q, t, COOLDOWN_MS - 1000, 35) // toujours lent, mais silence de 8 s après le changement
    expect(q.level).toBe('medium')
    feed(q, t + COOLDOWN_MS, 3000, 35)
    expect(q.level).toBe('low')
  })

  it('ne descend pas sous low', () => {
    const q = fresh({ cores: 2 })
    feed(q, 2000, 5000, 60)
    expect(q.level).toBe('low')
  })

  it('ignore les valeurs aberrantes (> 250 ms) : onglet resté caché, compilation de pipeline', () => {
    const q = fresh()
    for (let i = 0; i < 100; i++) q.sample(400, 2000 + i * 30)
    expect(q.level).toBe('high')
  })

  it('la première seconde après la reprise ou un changement de phase ne compte pas', () => {
    const q = fresh()
    q.warmup(0)
    for (let t = 10; t < 1000; t += 10) q.sample(200, t)
    expect(q.stats(1000)?.frame).toBeNull()
    expect(q.level).toBe('high')
  })

  it('le temps GPU du fond au-delà de 12 ms descend aussi (même règle que les ombres)', () => {
    const q = fresh()
    let t = 2000
    for (let i = 0; i < 100; i++) q.reportGpuMs(15, (t += 30))
    expect(q.level).toBe('medium')
  })

  it('le budget propre des ombres dépassé descend de high à medium, sans effet à medium', () => {
    const q = fresh()
    q.reportShadowsOver(1000)
    expect(q.level).toBe('medium')
    q.reportShadowsOver(2000)
    expect(q.level).toBe('medium')
  })
})

describe('remontée', () => {
  it('après une période calme, la remontée est mise en attente et appliquée seulement à la transition suivante', () => {
    const q = fresh()
    const t = feed(q, 2000, 3000, 35)
    expect(q.level).toBe('medium')
    const calm = feed(q, t + COOLDOWN_MS, 6500, 10)
    expect(q.pendingUp).toBe('high')
    expect(q.level).toBe('medium') // pas de remontée en pleine animation
    expect(q.settled).toBe('high') // le niveau posé n’a pas bougé non plus
    q.transition(calm)
    expect(q.level).toBe('high')
    expect(q.pendingUp).toBeNull()
  })

  it('pas de remontée pendant le silence qui suit un changement', () => {
    const q = fresh()
    const t = feed(q, 2000, 3000, 35)
    feed(q, t, COOLDOWN_MS - 500, 10)
    expect(q.pendingUp).toBeNull()
  })

  it('la remontée en attente tombe si les images se dégradent avant la transition', () => {
    const q = fresh()
    const t = feed(q, 2000, 3000, 35)
    const calm = feed(q, t + COOLDOWN_MS, 6500, 10)
    expect(q.pendingUp).toBe('high')
    const bad = feed(q, calm, 2500, 40) // les deux dernières secondes sont lentes
    q.transition(bad)
    expect(q.level).not.toBe('high')
  })

  it('le départ est un plafond : un appareil tactile ne dépasse pas medium', () => {
    const q = fresh({ coarse: true })
    feed(q, 2000, 12_000, 8)
    expect(q.pendingUp).toBeNull()
    q.transition(15_000)
    expect(q.level).toBe('medium')
  })

  it('remonter vers high remet à zéro le verdict « ombres coupées »', () => {
    const q = fresh()
    cutShadowsForSession()
    const t = feed(q, 2000, 3000, 35)
    const calm = feed(q, t + COOLDOWN_MS, 6500, 10)
    expect(shadowsCutForSession()).toBe(true) // en attente : rien ne change
    q.transition(calm)
    expect(q.level).toBe('high')
    expect(shadowsCutForSession()).toBe(false)
  })

  it('remontée vers high refusée tant que le GPU n’a pas la marge pour les ombres', () => {
    const q = fresh()
    const t = feed(q, 2000, 3000, 35)
    // Le fond coûte 9 ms de GPU sans ombres : sous le budget de 12 ms, mais sans marge pour les ombres.
    let g = t + COOLDOWN_MS
    for (let i = 0; i < 250; i++) q.reportGpuMs(9, (g += 30))
    feed(q, t + COOLDOWN_MS, 6500, 10)
    expect(q.pendingUp).toBeNull()
    // Contre-épreuve : avec 3 ms de GPU (marge large), la même période calme remonte.
    const r = fresh()
    const t2 = feed(r, 2000, 3000, 35)
    let g2 = t2 + COOLDOWN_MS
    for (let i = 0; i < 250; i++) r.reportGpuMs(3, (g2 += 30))
    feed(r, t2 + COOLDOWN_MS, 6500, 10)
    expect(r.pendingUp).toBe('high')
  })
})

describe('anti-yoyo', () => {
  it('après 2 descentes depuis high, on ne remonte plus à high de la session', () => {
    const q = fresh()
    let t = feed(q, 2000, 3000, 35) // 1re descente depuis high
    expect(q.level).toBe('medium')
    t = feed(q, t + COOLDOWN_MS, 6500, 10)
    q.transition(t)
    expect(q.level).toBe('high')
    t = feed(q, t + COOLDOWN_MS, 3000, 35) // 2e descente depuis high
    expect(q.level).toBe('medium')
    t = feed(q, t + COOLDOWN_MS, 8000, 6)
    expect(q.pendingUp).toBeNull()
    q.transition(t)
    expect(q.level).toBe('medium')
  })

  it('une seule descente n’interdit pas le retour', () => {
    const q = fresh()
    const t = feed(q, 2000, 3000, 35)
    const calm = feed(q, t + COOLDOWN_MS, 6500, 10)
    q.transition(calm)
    expect(q.level).toBe('high')
  })
})

describe('niveau posé', () => {
  it('settled ne suit une descente qu’à la transition (ressources coûteuses à recréer)', () => {
    const q = fresh()
    const t = feed(q, 2000, 3000, 35)
    expect(q.level).toBe('medium')
    expect(q.settled).toBe('high')
    q.transition(t)
    expect(q.settled).toBe('medium')
  })
})
