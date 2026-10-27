import { nextTick, ref, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Pas de DOM sous Vitest : la visibilité de l’onglet est une ref que le test pilote.
const visibility = vi.hoisted(() => ({ current: null as unknown as { value: string } }))
vi.mock('@vueuse/core', () => ({ useDocumentVisibility: () => visibility.current }))
import { startGpuLoop } from '../../src/effects/gpuLoop'

// vgpu simulé : `frameLoop` enregistre ses boucles, le test pilote les ticks à la main.
interface FakeLoop {
  cb: (f: unknown) => void
  fps: number | undefined
  stop: ReturnType<typeof vi.fn>
}
const loops: FakeLoop[] = []
let loseDevice: () => void = () => {}
const gpu = { lost: Promise.resolve(), dispose: vi.fn() }

vi.mock('vgpu', () => ({
  init: async () => {
    gpu.lost = new Promise<void>((resolve) => (loseDevice = resolve))
    return gpu
  },
  clock: () => ({ time: 0, deltaTime: 0.03, frameCount: 0, advance: () => {} }),
  frame: () => ({}),
  frameLoop: (_gpu: unknown, cb: (f: unknown) => void, opts?: { fps?: number }) => {
    const loop: FakeLoop = { cb, fps: opts?.fps, stop: vi.fn() }
    loops.push(loop)
    return loop
  },
}))

beforeEach(() => {
  loops.length = 0
  gpu.dispose.mockReset()
  visibility.current = shallowRef('visible')
})

const live = () => loops.filter((l) => l.stop.mock.calls.length === 0)
const flush = async () => {
  await nextTick()
  await Promise.resolve()
}

describe('startGpuLoop', () => {
  it('lance une boucle plafonnée à 30 i/s par défaut, ou au plafond demandé', async () => {
    await startGpuLoop({ setup: () => ({}), render: () => {} })
    expect(loops[0]!.fps).toBe(30)
    await startGpuLoop({ setup: () => ({}), render: () => {}, fps: 12 })
    expect(loops[1]!.fps).toBe(12)
  })

  it('arrête la boucle à la perte du périphérique et prévient une seule fois', async () => {
    const onLost = vi.fn()
    await startGpuLoop({ setup: () => ({}), render: () => {}, onLost })
    loseDevice()
    await flush()
    expect(loops[0]!.stop).toHaveBeenCalledTimes(1)
    expect(onLost).toHaveBeenCalledTimes(1)
    expect(gpu.dispose).not.toHaveBeenCalled()
  })

  it('traite une trame en échec comme une perte : boucle arrêtée, onLost appelé', async () => {
    const onLost = vi.fn()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await startGpuLoop({
      setup: () => ({}),
      render: () => {
        throw new Error('boom')
      },
      onLost,
    })
    expect(() => loops[0]!.cb({})).not.toThrow()
    expect(onLost).toHaveBeenCalledTimes(1)
    expect(loops[0]!.stop).toHaveBeenCalled()
    // Le bogue de rendu reste visible dans la console, avec l’erreur d’origine.
    expect(error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: 'boom' }))
  })

  it('double perte (trame en échec puis gpu.lost) : onLost une seule fois', async () => {
    const onLost = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await startGpuLoop({
      setup: () => ({}),
      render: () => {
        throw new Error('boom')
      },
      onLost,
    })
    loops[0]!.cb({})
    loseDevice()
    await flush()
    expect(onLost).toHaveBeenCalledTimes(1)
  })

  it('bascule rapide caché/visible : jamais plus d’une boucle vivante', async () => {
    await startGpuLoop({ setup: () => ({}), render: () => {} })
    for (let i = 0; i < 5; i++) {
      visibility.current.value = 'hidden'
      await flush()
      expect(live()).toHaveLength(0)
      visibility.current.value = 'visible'
      await flush()
      expect(live()).toHaveLength(1)
    }
    // Plusieurs bascules dans le même tick : une seule boucle au bout.
    visibility.current.value = 'hidden'
    visibility.current.value = 'visible'
    visibility.current.value = 'hidden'
    visibility.current.value = 'visible'
    await flush()
    expect(live()).toHaveLength(1)
  })

  it('un changement de cadence relance la boucle à la nouvelle cadence', async () => {
    const fps = ref(30)
    await startGpuLoop({ setup: () => ({}), render: () => {}, fps })
    fps.value = 4
    await flush()
    expect(live()).toHaveLength(1)
    expect(live()[0]!.fps).toBe(4)
  })

  it('stop est idempotent et ne lève pas même si teardown et dispose lèvent', async () => {
    const teardown = vi.fn(() => {
      throw new Error('effet déjà détruit')
    })
    gpu.dispose.mockImplementation(() => {
      throw new Error('périphérique perdu')
    })
    const onLost = vi.fn()
    const loop = await startGpuLoop({ setup: () => ({}), render: () => {}, teardown, onLost })
    expect(() => {
      loop.stop()
      loop.stop()
    }).not.toThrow()
    expect(teardown).toHaveBeenCalledTimes(1)
    expect(gpu.dispose).toHaveBeenCalledTimes(1)
    loseDevice() // perte après arrêt volontaire : ignorée
    await flush()
    expect(onLost).not.toHaveBeenCalled()
  })

  it('stop après une perte libère quand même, sans lever', async () => {
    const teardown = vi.fn()
    const loop = await startGpuLoop({ setup: () => ({}), render: () => {}, teardown })
    loseDevice()
    await flush()
    expect(() => loop.stop()).not.toThrow()
    expect(teardown).toHaveBeenCalledTimes(1)
    expect(gpu.dispose).toHaveBeenCalledTimes(1)
  })

  it('met en pause avec `paused` puis reprend avec une nouvelle boucle', async () => {
    const paused = ref(false)
    await startGpuLoop({ setup: () => ({}), render: () => {}, paused })
    expect(live()).toHaveLength(1)
    paused.value = true
    await flush()
    expect(live()).toHaveLength(0)
    paused.value = false
    await flush()
    expect(live()).toHaveLength(1)
    expect(loops).toHaveLength(2)
  })

  it('ne démarre pas du tout si `paused` est vrai dès le départ', async () => {
    await startGpuLoop({ setup: () => ({}), render: () => {}, paused: () => true })
    expect(loops).toHaveLength(0)
  })

  it('met en pause quand l’onglet est caché et reprend au retour', async () => {
    await startGpuLoop({ setup: () => ({}), render: () => {} })
    visibility.current.value = 'hidden'
    await flush()
    expect(live()).toHaveLength(0)
    visibility.current.value = 'visible'
    await flush()
    expect(live()).toHaveLength(1)
  })

  it('ne relance plus la boucle après stop, même si la pause change', async () => {
    const paused = ref(true)
    const loop = await startGpuLoop({ setup: () => ({}), render: () => {}, paused })
    loop.stop()
    paused.value = false
    await flush()
    expect(loops).toHaveLength(0)
  })

  it('libère le périphérique et relance l’erreur si setup échoue', async () => {
    await expect(
      startGpuLoop({
        setup: () => {
          throw new Error('shader invalide')
        },
        render: () => {},
      }),
    ).rejects.toThrow('shader invalide')
    expect(gpu.dispose).toHaveBeenCalledTimes(1)
  })

  it('passe l’état de setup et l’horloge à render', async () => {
    const render = vi.fn()
    await startGpuLoop({ setup: () => ({ n: 7 }), render })
    loops[0]!.cb({ f: 1 })
    expect(render).toHaveBeenCalledWith({ f: 1 }, { n: 7 }, expect.objectContaining({ deltaTime: 0.03 }))
  })
})
