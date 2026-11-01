import { describe, expect, it } from 'vitest'
import { COOLDOWN_MS, createFrameJudge, WARMUP_MS, type Verdict } from '@/effects/frameJudge'

/** Envoie des images de `ms` ms de t0 à t0 + durée ; renvoie les verdicts non nuls et l’instant atteint. */
const feed = (j: ReturnType<typeof createFrameJudge>, t0: number, durationMs: number, ms: number) => {
  const verdicts: { at: number; v: Verdict }[] = []
  let t = t0
  while (t < t0 + durationMs) {
    t += ms
    const v = j.push(ms, t)
    if (v) verdicts.push({ at: t, v })
  }
  return { verdicts, t }
}

describe('juge de fluidité', () => {
  it('descend quand la moyenne dépasse ~22 ms sur ~2 s, et pas avant que la fenêtre soit pleine', () => {
    const j = createFrameJudge()
    const { verdicts } = feed(j, 0, 3000, 30)
    expect(verdicts[0]?.v).toBe('down')
    expect(verdicts[0]!.at).toBeGreaterThanOrEqual(1800)
  })

  it('un à-coup isolé ne fait pas descendre, 60 i/s non plus', () => {
    const j = createFrameJudge()
    const a = feed(j, 0, 3000, 16.7)
    expect(a.verdicts.filter((x) => x.v === 'down')).toEqual([])
    j.push(240, a.t + 16)
    expect(feed(j, a.t + 20, 1000, 16.7).verdicts.filter((x) => x.v === 'down')).toEqual([])
  })

  it('remonte après ~5 s calmes (moyenne < 14 ms et p95 < 18 ms), pas avant', () => {
    const j = createFrameJudge()
    const { verdicts } = feed(j, 0, 7000, 10)
    const up = verdicts.find((x) => x.v === 'up')
    expect(up).toBeDefined()
    expect(up!.at).toBeGreaterThanOrEqual(4750)
  })

  it('sur un écran de 60 Hz (images de 16,7 ms au mieux), une période sans accroc remonte quand même', () => {
    const j = createFrameJudge()
    const { verdicts } = feed(j, 0, 7000, 16.7)
    expect(verdicts.find((x) => x.v === 'up')).toBeDefined()
    // Contre-épreuve : 24 ms constantes (rAF qui rate chaque synchro) ne remontent pas.
    expect(feed(createFrameJudge(), 0, 7000, 24).verdicts.find((x) => x.v === 'up')).toBeUndefined()
  })

  it('ne remonte pas si le p95 est mauvais même avec une bonne moyenne', () => {
    const j = createFrameJudge()
    let t = 0
    let up = false
    for (let i = 0; i < 700; i++) {
      const ms = i % 10 === 0 ? 40 : 8 // moyenne ~11 ms, p95 = 40 ms
      t += ms
      if (j.push(ms, t) === 'up') up = true
    }
    expect(up).toBe(false)
  })

  it('ignore les valeurs aberrantes (> 250 ms, négatives, NaN) et la grâce qui suit un redémarrage', () => {
    const j = createFrameJudge()
    for (const v of [251, 5000, -1, 0, Number.NaN, Infinity]) expect(j.push(v, 100)).toBeNull()
    expect(j.stats(5000, 100)).toBeNull()
    j.restart(1000, WARMUP_MS)
    expect(j.push(50, 1500)).toBeNull() // pendant la grâce
    expect(j.stats(5000, 1500)).toBeNull()
    j.push(50, 2001)
    expect(j.stats(5000, 2001)?.n).toBe(1)
  })

  it('le silence d’un changement de niveau dure ~8 s et un redémarrage plus court ne le raccourcit pas', () => {
    const j = createFrameJudge()
    j.restart(0, COOLDOWN_MS)
    j.restart(100, WARMUP_MS)
    expect(feed(j, 100, COOLDOWN_MS - 200, 40).verdicts).toEqual([])
    expect(feed(j, COOLDOWN_MS, 3000, 40).verdicts[0]?.v).toBe('down')
  })

  it('statistiques : moyenne et 95e centile sur la fenêtre demandée', () => {
    const j = createFrameJudge({ evalEveryMs: 1e9 })
    for (let i = 1; i <= 100; i++) j.push(i, i * 10)
    const s = j.stats(10_000, 1000)!
    expect(s.n).toBe(100)
    expect(s.mean).toBeCloseTo(50.5)
    expect(s.p95).toBe(95)
    expect(j.stats(100, 1000)!.n).toBeLessThanOrEqual(11)
  })
})
