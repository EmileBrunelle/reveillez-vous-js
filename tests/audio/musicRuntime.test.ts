import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mulberry32 } from '@/engine/rng'
import { TENSION_MIN_HZ, TENSION_OPEN_HZ, tensionCutoff } from '@/audio/musicPlan'
import { FakeCtx, param } from './fakeAudio'

// Pas de fenêtre en node : la visibilité de l’onglet est une ref pilotée par le test ; la phrase de piano est remplacée par un espion
// (sa synthèse est couverte par pianoVoice.test.ts), ce qui permet d’affirmer quand elle démarre, avec quoi, et comment elle s’arrête.
const h = vi.hoisted(() => ({
  visibility: { value: 'visible' } as { value: string },
  phrases: [] as { args: unknown[]; stop: ReturnType<typeof vi.fn>; end: number }[],
  phraseLength: 12,
  ticker: { paused: 0, resumed: 0 },
  generation: 0,
}))
vi.mock('@vueuse/core', async (importOriginal) => {
  const { ref } = await import('vue')
  const original = await importOriginal<typeof import('@vueuse/core')>()
  h.visibility = ref('visible')
  // `isClient` est figé à l’import de VueUse (sans fenêtre en node) : minuteries remplacées par de simples setInterval/setTimeout (horloge simulée).
  return {
    ...original,
    useDocumentVisibility: () => h.visibility,
    useEventListener: () => undefined,
    useIntervalFn: (cb: () => void, ms: number, opts: { immediate?: boolean } = {}) => {
      let id: ReturnType<typeof setInterval> | undefined
      const born = h.generation
      const resume = () => {
        if (h.generation !== born) return // instance d’un test précédent : ne se réveille pas
        clearInterval(id)
        id = setInterval(cb, ms)
        h.ticker.resumed++
      }
      const pause = () => {
        clearInterval(id)
        id = undefined
        if (h.generation === born) h.ticker.paused++
      }
      if (opts.immediate !== false) id = setInterval(cb, ms)
      return {
        pause,
        resume,
        isActive: {
          get value() {
            return id !== undefined
          },
        },
      }
    },
    useTimeoutFn: (cb: () => void, ms: number) => {
      let id: ReturnType<typeof setTimeout> | undefined
      return { start: () => void (id = setTimeout(cb, ms)), stop: () => clearTimeout(id) }
    },
  }
})
vi.mock('@/audio/pianoVoice', () => ({
  playPhrase: (...args: unknown[]) => {
    const handle = { args, stop: vi.fn(), end: (args[2] as number) + h.phraseLength }
    h.phrases.push(handle)
    return handle
  },
}))

const load = async () => {
  vi.resetModules()
  h.phrases = []
  h.visibility.value = 'visible'
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
  const sfx = await import('@/audio/sfx')
  const music = await import('@/audio/music')
  const { motifBusyUntil } = await import('@/audio/motif')
  const { stingerBusyUntil } = await import('@/audio/stinger')
  const { ambienceDucked } = await import('@/audio/ambience')
  const c = sfx.ac() as unknown as FakeCtx
  ambienceDucked.value = false
  motifBusyUntil.value = 0
  stingerBusyUntil.value = 0
  /** Avance l’horloge murale et celle du contexte d’autant, seconde par seconde (le piano regarde chaque seconde). */
  const advance = (s: number) => {
    for (let i = 0; i < s; i++) {
      c.currentTime += 1
      vi.advanceTimersByTime(1000)
    }
  }
  return { sfx, music, c, motifBusyUntil, stingerBusyUntil, ambienceDucked, advance, rng: mulberry32(1) }
}

beforeEach(() => {
  h.generation++
  h.ticker = { paused: 0, resumed: 0 }
  h.phrases = []
  h.visibility.value = 'visible'
  FakeCtx.instances = []
  vi.useFakeTimers()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
  vi.stubGlobal('window', { AudioContext: FakeCtx })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Le dernier filtre de tension créé par startMusic (le seul biquad du contexte avant toute phrase). */
const filterOf = (c: FakeCtx) => c.all('biquad')[0]

describe('startMusic : démarrage', () => {
  it('sans AudioContext : renvoie un arrêt inoffensif', async () => {
    vi.stubGlobal('window', {})
    vi.resetModules()
    const { startMusic } = await import('@/audio/music')
    const stop = startMusic()
    expect(() => stop()).not.toThrow()
    expect(h.phrases).toHaveLength(0)
  })

  it('câblage : sortie -> passe-bas ouvert (18 kHz, sans résonance) -> bus d’ambiance', async () => {
    const { music, sfx, c, rng } = await load()
    const avant = c.nodes.length
    music.startMusic(() => 1, rng)
    const [out, filter] = c.nodes.slice(avant)
    expect(param(out, 'gain').value).toBe(1)
    expect(filter.type).toBe('lowpass')
    expect(param(filter, 'frequency').value).toBe(TENSION_OPEN_HZ)
    expect(param(filter, 'Q').value).toBe(0)
    expect(out.connections).toEqual([filter])
    expect(filter.connections).toEqual([sfx.ambienceOut(c as unknown as AudioContext)])
  })

  it('la première phrase attend 40 % de l’intervalle minimal au moins (16 s), pas de départ immédiat', async () => {
    const { music, advance, rng } = await load()
    music.startMusic(() => 1, rng)
    advance(15)
    expect(h.phrases).toHaveLength(0)
    advance(25) // 40 s : au plus 90 × 0,4 = 36 s d’attente
    expect(h.phrases).toHaveLength(1)
  })

  it('la phrase part à t0 = maintenant + 100 ms, sans flottement au niveau 1, flottement de 6 cents aux niveaux 3–4, aucun au niveau 5', async () => {
    const wobbles: number[] = []
    for (const level of [1, 3, 4, 5]) {
      const { music, advance, c, rng } = await load()
      music.startMusic(() => level, rng)
      advance(40)
      const [, , t0, notes, wobble] = h.phrases[0].args as [unknown, unknown, number, unknown[], number]
      expect(t0 - 0.1 - Math.floor(t0 - 0.1)).toBeCloseTo(0, 6) // horloge entière + 100 ms
      expect(t0).toBeGreaterThanOrEqual(16.1) // jamais avant 40 × 0,4 s
      expect(t0).toBeLessThanOrEqual(36.1)
      expect(c.currentTime).toBe(40)
      expect(notes.length).toBeGreaterThan(0)
      wobbles.push(wobble)
    }
    expect(wobbles).toEqual([0, 6, 6, 0])
  })

  it('une seule phrase à la fois ; la suivante vient après sa durée (12 s) plus un silence de 40 à 90 s', async () => {
    const { music, advance, rng } = await load()
    music.startMusic(() => 1, rng)
    while (h.phrases.length === 0) advance(1)
    advance(51) // 12 s de phrase + 40 s de silence minimal : pas encore
    expect(h.phrases).toHaveLength(1)
    let attente = 51
    while (h.phrases.length === 1) {
      advance(1)
      attente++
    }
    expect(attente).toBeLessThanOrEqual(12 + 90 + 1)
    expect(h.phrases).toHaveLength(2)
  })

  it('la phrase occupe motifBusyUntil pendant qu’elle joue, pour que ni leitmotif ni jingle ne démarre dessus', async () => {
    const { music, advance, motifBusyUntil, c, rng } = await load()
    music.startMusic(() => 1, rng)
    advance(40)
    expect(motifBusyUntil.value).toBeGreaterThan(c.currentTime)
  })
})

describe('startMusic : conditions de départ', () => {
  const blocked = async (setup: (ctx: Awaited<ReturnType<typeof load>>) => void) => {
    const ctx = await load()
    ctx.music.startMusic(() => 1, ctx.rng)
    setup(ctx)
    await nextTick()
    ctx.advance(40)
    return h.phrases.length
  }
  it('rien pendant un leitmotif', async () => {
    expect(await blocked((x) => (x.motifBusyUntil.value = 1000))).toBe(0)
  })
  it('rien pendant un jingle', async () => {
    expect(await blocked((x) => (x.stingerBusyUntil.value = 1000))).toBe(0)
  })
  it('rien en sourdine', async () => {
    expect(await blocked((x) => (x.sfx.muted.value = true))).toBe(0)
  })
  it('rien pendant la finale (ambiance étouffée)', async () => {
    expect(await blocked((x) => (x.ambienceDucked.value = true))).toBe(0)
  })
  it('rien tant que le contexte ne tourne pas', async () => {
    expect(await blocked((x) => (x.c.state = 'suspended'))).toBe(0)
  })
  it('rien onglet caché', async () => {
    expect(await blocked(() => (h.visibility.value = 'hidden'))).toBe(0)
  })
})

describe('startMusic : coupures', () => {
  const playing = async (level = 1) => {
    const ctx = await load()
    const stop = ctx.music.startMusic(() => level, ctx.rng)
    ctx.advance(40)
    const phrase = h.phrases[0]
    return { ...ctx, stop, phrase }
  }

  it('la sourdine coupe la phrase en 0,3 s, libère l’occupation posée et rouvre le filtre', async () => {
    const { sfx, c, phrase, motifBusyUntil } = await playing()
    expect(motifBusyUntil.value).toBeGreaterThan(0)
    sfx.muted.value = true
    await nextTick()
    expect(phrase.stop).toHaveBeenCalledWith(0.3)
    expect(motifBusyUntil.value).toBe(0)
    const f = filterOf(c)
    expect(param(f, 'frequency').of('setTargetAtTime').at(-1)![0]).toBe(TENSION_OPEN_HZ)
  })

  it('retour du son : pas de reprise immédiate, 8 à 20 s de délai au moins', async () => {
    const { sfx, advance } = await playing()
    sfx.muted.value = true
    await nextTick()
    advance(100) // la fin de silence normale serait passée
    sfx.muted.value = false
    await nextTick()
    advance(7)
    expect(h.phrases).toHaveLength(1)
    advance(14) // 21 s au total : au-delà du délai maximal de 20 s
    expect(h.phrases).toHaveLength(2)
  })

  it('l’onglet caché met le ticker en pause, le retour le reprend', async () => {
    await playing()
    h.ticker.paused = h.ticker.resumed = 0
    h.visibility.value = 'hidden'
    await nextTick()
    expect(h.ticker).toEqual({ paused: 1, resumed: 0 })
    h.visibility.value = 'visible'
    await nextTick()
    expect(h.ticker).toEqual({ paused: 1, resumed: 1 })
  })

  it('l’onglet caché coupe la phrase ; son retour attend 8 à 20 s', async () => {
    const { phrase, advance } = await playing()
    h.visibility.value = 'hidden'
    await nextTick()
    expect(phrase.stop).toHaveBeenCalledWith(0.3)
    advance(200)
    expect(h.phrases).toHaveLength(1)
    h.visibility.value = 'visible'
    await nextTick()
    advance(7)
    expect(h.phrases).toHaveLength(1)
    advance(14)
    expect(h.phrases).toHaveLength(2)
  })

  it('la finale (ambiance étouffée) coupe la phrase ; sa fin attend le délai de reprise', async () => {
    const { phrase, ambienceDucked, advance } = await playing()
    ambienceDucked.value = true
    await nextTick()
    expect(phrase.stop).toHaveBeenCalledWith(0.3)
    ambienceDucked.value = false
    await nextTick()
    advance(7)
    expect(h.phrases).toHaveLength(1)
  })

  it('un jingle qui démarre coupe la phrase', async () => {
    const { phrase, stingerBusyUntil, c } = await playing()
    stingerBusyUntil.value = c.currentTime + 2
    await nextTick()
    expect(phrase.stop).toHaveBeenCalledWith(0.3)
  })

  it('un leitmotif étranger coupe la phrase ; sa propre occupation ne la coupe pas', async () => {
    const { phrase, motifBusyUntil, c } = await playing()
    expect(phrase.stop).not.toHaveBeenCalled() // la propre occupation posée au départ
    const mienne = motifBusyUntil.value
    motifBusyUntil.value = mienne + 5 // un autre son prolonge l’occupation
    await nextTick()
    expect(phrase.stop).toHaveBeenCalledWith(0.3)
    // l’occupation d’un autre n’est pas rabaissée par la coupure
    expect(motifBusyUntil.value).toBe(mienne + 5)
    expect(c.currentTime).toBeGreaterThan(0)
  })

  it('arrêt : fondu de 1,5 s de la sortie, phrase coupée, nœuds débranchés après 1,8 s, plus de phrase ensuite ; idempotent', async () => {
    const { stop, phrase, c, advance } = await playing()
    const out = c.nodes.find((n) => n.kind === 'gain' && n.connections[0] === filterOf(c))!
    stop()
    expect(phrase.stop).toHaveBeenCalledWith(1.5)
    expect(param(out, 'gain').of('cancelScheduledValues')).toHaveLength(1)
    expect(param(out, 'gain').of('setValueAtTime').length).toBeGreaterThan(0)
    expect(out.disconnected).toBe(0)
    vi.advanceTimersByTime(1799)
    expect(out.disconnected).toBe(0)
    vi.advanceTimersByTime(2)
    expect(out.disconnected).toBe(1)
    expect(filterOf(c).disconnected).toBe(1)
    advance(300)
    expect(h.phrases).toHaveLength(1)
    stop()
    expect(phrase.stop).toHaveBeenCalledTimes(1)
  })

  it('arrêter sans phrase en cours ne plante pas', async () => {
    const { music, rng } = await load()
    const stop = music.startMusic(() => 1, rng)
    expect(() => stop()).not.toThrow()
  })

  it('une phrase finie d’elle-même n’est plus coupée par la sourdine', async () => {
    const { sfx, advance, phrase } = await playing()
    advance(13) // la phrase (12 s) est terminée
    sfx.muted.value = true
    await nextTick()
    expect(phrase.stop).not.toHaveBeenCalled()
  })
})

describe('tension du filtre', () => {
  const started = async () => {
    const ctx = await load()
    ctx.music.startMusic(() => 1, ctx.rng)
    const f = filterOf(ctx.c)
    return { ...ctx, f, targets: () => param(f, 'frequency').of('setTargetAtTime') }
  }

  it('setMusicTension ferme le filtre vers tensionCutoff(t) avec une constante de 0,4 s, à partir de la valeur courante', async () => {
    const { music, f, c, targets } = await started()
    c.currentTime = 5
    music.setMusicTension(0.5)
    expect(param(f, 'frequency').of('cancelScheduledValues')).toEqual([[5]])
    expect(param(f, 'frequency').of('setValueAtTime').at(-1)).toEqual([TENSION_OPEN_HZ, 5])
    expect(targets().at(-1)![0]).toBeCloseTo(tensionCutoff(0.5))
    expect(targets().at(-1)![1]).toBe(5)
    expect(targets().at(-1)![2]).toBe(0.4)
  })

  it('valeurs hors bornes ou NaN ramenées dans [0 ; 1] : jamais de fréquence ≤ 0', async () => {
    const { music, targets } = await started()
    music.setMusicTension(3)
    expect(targets().at(-1)![0]).toBeCloseTo(TENSION_MIN_HZ)
    music.setMusicTension(-2)
    expect(targets().at(-1)![0]).toBeCloseTo(TENSION_OPEN_HZ)
    music.setMusicTension(Number.NaN)
    expect(targets().at(-1)![0]).toBeCloseTo(TENSION_OPEN_HZ)
  })

  it('sans musique : sans effet et sans erreur', async () => {
    vi.resetModules()
    const music = await import('@/audio/music')
    expect(() => {
      music.setMusicTension(0.7)
      music.releaseMusicTension('win')
    }).not.toThrow()
  })

  it('en sourdine ou onglet caché, la demande est retenue mais le filtre ne bouge pas ; elle revient avec le son', async () => {
    const { music, sfx, f, targets } = await started()
    sfx.muted.value = true
    await nextTick()
    const base = targets().length
    music.setMusicTension(0.8)
    expect(targets()).toHaveLength(base)
    sfx.muted.value = false
    await nextTick()
    expect(targets().at(-1)![0]).toBeCloseTo(tensionCutoff(0.8))
    expect(param(f, 'frequency').of('setTargetAtTime').at(-1)![2]).toBe(0.4)

    h.visibility.value = 'hidden'
    await nextTick()
    const apres = targets().length
    music.setMusicTension(0.2)
    expect(targets()).toHaveLength(apres)
    h.visibility.value = 'visible'
    await nextTick()
    expect(targets().at(-1)![0]).toBeCloseTo(tensionCutoff(0.2))
  })

  it('releaseMusicTension : réussite = réouverture rapide (0,13 s)', async () => {
    const { music, targets } = await started()
    music.setMusicTension(1)
    music.releaseMusicTension('win')
    expect(targets().at(-1)).toEqual([TENSION_OPEN_HZ, 0, 0.13])
  })

  it('releaseMusicTension : échec = reste fermé 1,5 s puis se rouvre lentement (0,7 s)', async () => {
    const { music, c, targets } = await started()
    c.currentTime = 2
    music.setMusicTension(1)
    music.releaseMusicTension('fail')
    expect(targets().at(-1)).toEqual([TENSION_OPEN_HZ, 3.5, 0.7])
  })

  it('releaseMusicTension : sans issue = retour doux (0,1 s) ; la tension voulue est oubliée', async () => {
    const { music, sfx, targets } = await started()
    music.setMusicTension(1)
    music.releaseMusicTension()
    expect(targets().at(-1)).toEqual([TENSION_OPEN_HZ, 0, 0.1])
    const n = targets().length
    sfx.muted.value = true
    await nextTick()
    sfx.muted.value = false
    await nextTick()
    // la sourdine rouvre le filtre mais ne réapplique aucune tension oubliée
    expect(
      targets()
        .slice(n)
        .every(([hz]) => hz === TENSION_OPEN_HZ),
    ).toBe(true)
  })

  it('une tension déjà demandée s’applique dès le démarrage d’une nouvelle instance', async () => {
    const ctx = await load()
    ctx.music.setMusicTension(0.6)
    ctx.music.startMusic(() => 1, ctx.rng)
    const f = filterOf(ctx.c)
    expect(param(f, 'frequency').of('setTargetAtTime').at(-1)![0]).toBeCloseTo(tensionCutoff(0.6))
  })

  it('après l’arrêt de l’instance, la tension n’agit plus sur son filtre', async () => {
    const { music, music: m, targets } = await started()
    void m
    const stop = music.startMusic()
    stop()
    const n = targets().length
    music.setMusicTension(0.9)
    expect(targets()).toHaveLength(n)
  })
})
