import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { CHUNK_RETRIES, CHUNK_RETRY_DELAY_MS, lazyScene, retryChunk } from '../../src/composables/lazyScene'

const Scene = { props: { level: Number }, render: (ctx: { level: number }) => h('p', `scène niveau ${ctx.level}`) }

const render = async (loader: () => Promise<{ default: object }>, skip?: () => void) => {
  const Lazy = lazyScene(loader as never, skip)
  const app = createSSRApp({ render: () => h(Lazy, { level: 3 }) })
  const done = renderToString(app)
  await vi.advanceTimersByTimeAsync(CHUNK_RETRY_DELAY_MS * (CHUNK_RETRIES + 1))
  return done
}

describe('retryChunk', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('relance après un court délai tant que les essais ne sont pas épuisés', async () => {
    const retry = vi.fn()
    const fail = vi.fn()
    retryChunk(new Error('réseau'), retry, fail, 1)
    expect(retry).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(CHUNK_RETRY_DELAY_MS)
    expect(retry).toHaveBeenCalledTimes(1)
    expect(fail).not.toHaveBeenCalled()
  })

  it('abandonne au-delà de deux nouveaux essais', () => {
    const retry = vi.fn()
    const fail = vi.fn()
    retryChunk(new Error('réseau'), retry, fail, CHUNK_RETRIES + 1)
    expect(fail).toHaveBeenCalledTimes(1)
    expect(retry).not.toHaveBeenCalled()
  })
})

describe('lazyScene', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('se rétablit si le chunk échoue puis répond (les attributs traversent)', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockRejectedValueOnce(new Error('réseau')).mockResolvedValue({ __esModule: true, default: Scene })
    const html = await render(loader)
    expect(loader).toHaveBeenCalledTimes(3)
    expect(html).toContain('scène niveau 3')
  })

  it('après deux nouveaux essais, affiche le repli « Réessayer » sans bloquer', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('réseau'))
    const html = await render(loader)
    expect(loader).toHaveBeenCalledTimes(CHUNK_RETRIES + 1)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Réessayer')
    expect(html).not.toContain('Passer')
  })

  it('propose « Passer » quand la scène sait être sautée', async () => {
    const html = await render(
      () => Promise.reject(new Error('réseau')),
      () => undefined,
    )
    expect(html).toContain('Passer')
  })
})
