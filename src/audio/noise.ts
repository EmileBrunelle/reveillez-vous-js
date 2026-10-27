/** Tampons de bruit blanc, un par contexte et par durée : générés une fois, puis partagés par tous les sons (pas de bruit recalculé à chaque coup). */
const cache = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>()

export const noiseBuffer = (c: BaseAudioContext, seconds: number): AudioBuffer => {
  let byDuration = cache.get(c)
  if (!byDuration) cache.set(c, (byDuration = new Map()))
  let buf = byDuration.get(seconds)
  if (!buf) {
    buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    byDuration.set(seconds, buf)
  }
  return buf
}
