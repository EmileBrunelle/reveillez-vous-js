import { ref } from 'vue'

export const muted = ref(false)

let ctx: AudioContext | null = null
export const ac = (): AudioContext | null => {
  if (ctx?.state === 'closed') ctx = null
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  return ctx
}

export const unlock = () => {
  const c = ac()
  if (c && c.state !== 'running') void c.resume()
}

export const noiseBuffer = (c: AudioContext, seconds: number) => {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

const burst = (c: AudioContext, at: number, dur: number, freq: number, gain: number) => {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, dur)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = freq
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + dur)
  src.connect(f).connect(g).connect(c.destination)
  src.start(at)
  return [src]
}

export interface KnockHandle {
  /** Hit times on the clock `now()` reads (the AudioContext clock when it is running). */
  times: number[]
  now: () => number
  cancel: () => void
}

const thump = (c: AudioContext, at: number, gain: number) => {
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(140, at)
  o.frequency.exponentialRampToValueAtTime(50, at + 0.1)
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.12)
  o.connect(g).connect(c.destination)
  o.start(at)
  o.stop(at + 0.13)
  return o
}

/** One knock (noise burst + thump) scheduled at audio time `at`; returns the sources so they can be stopped. */
const knockAt = (c: AudioContext, at: number, intensity: number): AudioScheduledSourceNode[] => [...burst(c, at, 0.12, 400, 0.4 + 0.5 * intensity), thump(c, at, 0.3 + 0.4 * intensity)]

/** Plays one knock now. Silent when muted or when the audio context is not running (not unlocked yet). */
export const knock = (intensity: number) => {
  if (muted.value || !ctx || ctx.state !== 'running') return
  knockAt(ctx, ctx.currentTime, intensity)
}

/**
 * Schedules knocks at `offsets` (seconds from the first, which plays ~50 ms from now) on the Web Audio clock
 * and calls `onHit` from a rAF loop when the clock reaches each hit (shifted by the output latency), so
 * visuals and sound share one time base. Before audio is unlocked (no running context) the same schedule
 * runs silently on performance.now().
 */
export const scheduleKnocks = (offsets: number[], intensity: number, onHit: (i: number, intensity: number) => void): KnockHandle => {
  const live = ctx !== null && ctx.state === 'running'
  const now = live ? () => ctx!.currentTime : () => performance.now() / 1000
  const t0 = now() + 0.05
  const times = offsets.map((o) => t0 + o)
  const sources: AudioScheduledSourceNode[] = []
  if (live && !muted.value) times.forEach((t) => sources.push(...knockAt(ctx!, t, intensity)))
  const latency = live ? (ctx!.outputLatency || 0) + ctx!.baseLatency : 0
  let i = 0
  let raf = 0
  const tick = () => {
    const n = now()
    while (i < times.length && n >= times[i] + latency) onHit(i++, intensity)
    if (i < times.length) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return {
    times,
    now,
    cancel() {
      cancelAnimationFrame(raf)
      i = times.length
      sources.forEach((s) => {
        try {
          s.stop()
        } catch {
          /* already stopped */
        }
      })
    },
  }
}

export const creak = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(90, t)
  o.frequency.linearRampToValueAtTime(150, t + 0.25)
  o.frequency.linearRampToValueAtTime(75, t + 0.5)
  o.frequency.linearRampToValueAtTime(190, t + 0.8)
  const lfo = c.createOscillator()
  lfo.frequency.value = 19
  const lg = c.createGain()
  lg.gain.value = 12
  lfo.connect(lg).connect(o.frequency)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 6
  f.frequency.setValueAtTime(600, t)
  f.frequency.linearRampToValueAtTime(1400, t + 0.8)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.12, t + 0.1)
  g.gain.linearRampToValueAtTime(0.0001, t + 0.85)
  o.connect(f).connect(g).connect(c.destination)
  o.start(t)
  lfo.start(t)
  o.stop(t + 0.9)
  lfo.stop(t + 0.9)
}

export const slam = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  burst(c, t, 0.25, 700, 1)
  thump(c, t, 1)
}

export const hymn = () => {
  const c = ac()
  if (!c || muted.value) return
  const notes = [262, 330, 392, 523, 392]
  const t = c.currentTime
  notes.forEach((hz, i) => {
    const o = c.createOscillator()
    o.type = 'square'
    o.frequency.value = hz
    const g = c.createGain()
    g.gain.setValueAtTime(0.06, t + i * 0.2)
    g.gain.setValueAtTime(0.0001, t + i * 0.2 + 0.18)
    o.connect(g).connect(c.destination)
    o.start(t + i * 0.2)
    o.stop(t + i * 0.2 + 0.2)
  })
}

/** Card slides in: a short filtered-noise swish rising in pitch. */
export const cardDeal = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.25)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 1.2
  f.frequency.setValueAtTime(900, t)
  f.frequency.exponentialRampToValueAtTime(3800, t + 0.2)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.22, t + 0.06)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
  src.connect(f).connect(g).connect(c.destination)
  src.start(t)
}

/** Card flips: a papery snap and a small bright blip on the landing. */
export const cardFlip = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  burst(c, t, 0.08, 6000, 0.35)
  const o = c.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(520, t + 0.16)
  o.frequency.exponentialRampToValueAtTime(880, t + 0.26)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.setValueAtTime(0.09, t + 0.16)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + 0.32)
}

/** Card lands after the flip: a short, dull paper thud (low-passed noise, no tone). */
export const cardThud = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.14)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 0.8
  f.frequency.setValueAtTime(700, t)
  f.frequency.exponentialRampToValueAtTime(180, t + 0.12)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.4, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.13)
  src.connect(f).connect(g).connect(c.destination)
  src.start(t)
}

const beep = (c: AudioContext, at: number, from: number, to: number, dur: number, gain: number) => {
  const o = c.createOscillator()
  o.type = 'square'
  o.frequency.setValueAtTime(from, at)
  o.frequency.linearRampToValueAtTime(to, at + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.setValueAtTime(0.0001, at + dur)
  o.connect(g).connect(c.destination)
  o.start(at)
  o.stop(at + dur + 0.01)
}

/** About opens: two short PC-speaker style beeps, rising (old program booting). */
export const aboutOpen = () => {
  const c = ac()
  if (!c || muted.value) return
  const t = c.currentTime
  beep(c, t, 440, 440, 0.07, 0.05)
  beep(c, t + 0.1, 880, 880, 0.09, 0.05)
}

/** About closes: one short falling blip. */
export const aboutClose = () => {
  const c = ac()
  if (!c || muted.value) return
  beep(c, c.currentTime, 660, 330, 0.1, 0.045)
}
