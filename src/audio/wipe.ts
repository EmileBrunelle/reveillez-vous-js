import { watch } from 'vue'
import { ac, muted, noiseBuffer } from './sfx'

// Frottement d’un chiffon sur du verre : bruit passe-bande dont le gain et la fréquence suivent la vitesse du geste.
// Vitesse en rayons de boule par seconde (le disque a un rayon de 1).
export const SPEED_MAX = 4
export const GAIN_MAX = 0.07
export const FREQ_MIN = 1500
export const FREQ_MAX = 4000
export const SQUEAK_FROM = 0.75 // part de SPEED_MAX au-delà de laquelle le couinement perce
export const SQUEAK_MAX = 0.008
const SMOOTH = 0.06 // constante de temps (s) du suivi de la vitesse
const RELEASE = 0.04 // constante de temps (s) de la retombée : ≈ 150 ms pour passer sous 3 %
const IDLE_MS = 90 // sans mouvement depuis ce délai, le geste est considéré arrêté

export interface WipeParams {
  gain: number
  freq: number
  squeak: number
}

const clamp01 = (x: number) => (Number.isNaN(x) ? 0 : Math.min(1, Math.max(0, x)))

// Fonction pure : vitesse → gain, fréquence du filtre et gain du couinement. Bornée, monotone, zéro gain à l’arrêt.
export const wipeParams = (speed: number): WipeParams => {
  const s = clamp01(speed / SPEED_MAX)
  const sq = clamp01((s - SQUEAK_FROM) / (1 - SQUEAK_FROM))
  return { gain: GAIN_MAX * Math.sqrt(s), freq: FREQ_MIN + (FREQ_MAX - FREQ_MIN) * s, squeak: SQUEAK_MAX * sq * sq }
}

export interface WipeSound {
  /** Un déplacement de `distance` (rayons de boule) vient d’avoir lieu. */
  move(distance: number): void
  /** Le geste s’arrête : le son retombe à zéro. */
  rest(): void
  /** Arrêt définitif et nettoyage des nœuds. */
  stop(): void
}

const silent: WipeSound = { move: () => undefined, rest: () => undefined, stop: () => undefined }

export const startWipeSound = (): WipeSound => {
  const c = ac()
  if (!c) return silent
  let nodes: { src: AudioBufferSourceNode; osc: OscillatorNode; band: BiquadFilterNode; g: GainNode; sg: GainNode; out: GainNode } | null = null
  let stopped = false
  let lastT: number | null = null
  let idle: ReturnType<typeof setTimeout> | undefined
  let unwatch: (() => void) | undefined

  const build = () => {
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c, 2)
    src.loop = true
    const band = c.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = 1.4
    band.frequency.value = FREQ_MIN
    const g = c.createGain()
    g.gain.value = 0
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 3100
    const sg = c.createGain()
    sg.gain.value = 0
    // Sortie des effets : la sourdine (`muted` de sfx.ts) coupe ce nœud, comme les autres effets ponctuels.
    const out = c.createGain()
    out.gain.value = muted.value ? 0 : 1
    src.connect(band).connect(g).connect(out)
    osc.connect(sg).connect(out)
    out.connect(c.destination)
    src.start()
    osc.start()
    unwatch = watch(muted, (m) => out.gain.setTargetAtTime(m ? 0 : 1, c.currentTime, 0.03))
    return { src, osc, band, g, sg, out }
  }

  const apply = (p: WipeParams, tc: number) => {
    if (!nodes) return
    const t = c.currentTime
    nodes.g.gain.setTargetAtTime(p.gain, t, tc)
    nodes.band.frequency.setTargetAtTime(p.freq, t, tc)
    nodes.sg.gain.setTargetAtTime(p.squeak, t, tc)
  }

  const rest = () => {
    clearTimeout(idle)
    lastT = null
    apply({ gain: 0, freq: FREQ_MIN, squeak: 0 }, RELEASE)
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    clearTimeout(idle)
    unwatch?.()
    if (!nodes) return
    const n = nodes
    nodes = null
    const t = c.currentTime
    n.g.gain.setTargetAtTime(0, t, RELEASE)
    n.sg.gain.setTargetAtTime(0, t, RELEASE)
    try {
      n.src.stop(t + 0.3)
      n.osc.stop(t + 0.3)
    } catch {
      // déjà arrêtés
    }
    setTimeout(() => {
      for (const x of [n.src, n.osc, n.band, n.g, n.sg, n.out]) x.disconnect()
    }, 350)
  }

  const move = (distance: number) => {
    if (stopped) return
    const t = performance.now()
    const dt = lastT === null ? 0 : (t - lastT) / 1000
    lastT = t
    if (dt <= 0 || dt > 0.25) return // premier point ou reprise après une pause : pas de vitesse mesurable
    if (c.state !== 'running') void c.resume()
    nodes ??= build()
    apply(wipeParams(distance / dt), SMOOTH)
    clearTimeout(idle)
    idle = setTimeout(rest, IDLE_MS)
  }

  return { move, rest, stop }
}
