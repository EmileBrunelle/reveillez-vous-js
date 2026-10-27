import { describe, expect, it, vi } from 'vitest'
import { NOISE_SECONDS, noiseBuffer, startNoise } from '../../src/audio/noise'

const makeCtx = () => {
  const createBuffer = vi.fn((_ch: number, n: number) => ({ duration: NOISE_SECONDS, getChannelData: () => new Float32Array(n) }))
  return { sampleRate: 100, createBuffer } as unknown as BaseAudioContext & { createBuffer: typeof createBuffer }
}
const makeSrc = () => ({ buffer: null as unknown, start: vi.fn() }) as unknown as AudioBufferSourceNode & { start: ReturnType<typeof vi.fn> }

describe('noiseBuffer', () => {
  it('un seul tampon par contexte, généré une fois', () => {
    const c = makeCtx()
    expect(noiseBuffer(c)).toBe(noiseBuffer(c))
    expect(c.createBuffer).toHaveBeenCalledTimes(1)
    expect(c.createBuffer).toHaveBeenCalledWith(1, 100 * NOISE_SECONDS, 100)
  })
  it('un tampon distinct par contexte', () => {
    expect(noiseBuffer(makeCtx())).not.toBe(noiseBuffer(makeCtx()))
  })
})

describe('startNoise', () => {
  it('même tampon, mais décalage de départ différent à chaque coup, borné pour que le segment tienne', () => {
    const c = makeCtx()
    const offsets = new Set<number>()
    for (let i = 0; i < 20; i++) {
      const s = makeSrc()
      startNoise(c, s, 1.5, 0.25)
      expect(s.buffer).toBe(noiseBuffer(c))
      const [at, offset, dur] = s.start.mock.calls[0]
      expect(at).toBe(1.5)
      expect(dur).toBe(0.25)
      expect(offset).toBeGreaterThanOrEqual(0)
      expect(offset + dur).toBeLessThanOrEqual(NOISE_SECONDS)
      offsets.add(offset)
    }
    expect(offsets.size).toBeGreaterThan(1)
  })
  it('sans durée : lit tout le tampon (pour une boucle) à un décalage aléatoire', () => {
    const c = makeCtx()
    const s = makeSrc()
    startNoise(c, s, 0)
    expect(s.start.mock.calls[0]).toHaveLength(2)
  })
})
