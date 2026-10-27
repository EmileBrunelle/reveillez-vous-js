/** Durée du tampon de bruit partagé : couvre la plus longue houle d’ambiance (6 s) avec un décalage de départ. */
export const NOISE_SECONDS = 9

const cache = new WeakMap<BaseAudioContext, AudioBuffer>()

/** Un seul tampon de bruit blanc par contexte, généré à la première demande puis partagé par tous les sons. */
export const noiseBuffer = (c: BaseAudioContext): AudioBuffer => {
  let buf = cache.get(c)
  if (!buf) {
    buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * NOISE_SECONDS)), c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    cache.set(c, buf)
  }
  return buf
}

/**
 * Branche le tampon partagé sur `src` et le démarre à `at`, à un décalage aléatoire : chaque coup a sa propre texture
 * même si le tampon est le même. Avec `dur`, la source ne lit que ce segment ; sans `dur`, elle lit tout le tampon
 * (à boucler par l’appelant).
 */
export const startNoise = (c: BaseAudioContext, src: AudioBufferSourceNode, at: number, dur?: number) => {
  const buf = noiseBuffer(c)
  src.buffer = buf
  if (dur === undefined) src.start(at, Math.random() * buf.duration)
  else src.start(at, Math.random() * (buf.duration - dur), dur)
}
