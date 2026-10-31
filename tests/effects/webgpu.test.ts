import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasWebGpuAdapter } from '@/effects/webgpu'

const stubGpu = (gpu: unknown) => vi.stubGlobal('navigator', { gpu })

describe('hasWebGpuAdapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('faux sans navigator.gpu', async () => {
    stubGpu(undefined)
    expect(await hasWebGpuAdapter()).toBe(false)
  })

  it('vrai quand requestAdapter renvoie un adaptateur', async () => {
    stubGpu({ requestAdapter: async () => ({}) })
    expect(await hasWebGpuAdapter()).toBe(true)
  })

  it('faux quand aucun adaptateur n’est disponible (null)', async () => {
    stubGpu({ requestAdapter: async () => null })
    expect(await hasWebGpuAdapter()).toBe(false)
  })

  it('faux, sans lever, quand requestAdapter rejette', async () => {
    stubGpu({
      requestAdapter: async () => {
        throw new Error('bloqué')
      },
    })
    expect(await hasWebGpuAdapter()).toBe(false)
  })
})
