// Faux Web Audio enregistreur pour les tests de `src/audio/` : chaque nœud garde ses connexions, ses démarrages/arrêts
// et chaque paramètre garde la liste de ses appels (valeur initiale, rampes, cibles), ce qui permet d’affirmer le comportement.
export interface ParamCall {
  fn: 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime' | 'setTargetAtTime' | 'cancelScheduledValues'
  args: number[]
}

export class FakeParam {
  value = 0
  calls: ParamCall[] = []
  private rec =
    (fn: ParamCall['fn']) =>
    (...args: number[]) => {
      this.calls.push({ fn, args })
      return this
    }
  setValueAtTime = this.rec('setValueAtTime')
  linearRampToValueAtTime = this.rec('linearRampToValueAtTime')
  exponentialRampToValueAtTime = this.rec('exponentialRampToValueAtTime')
  setTargetAtTime = this.rec('setTargetAtTime')
  cancelScheduledValues = this.rec('cancelScheduledValues')
  /** Appels d’un type donné. */
  of = (fn: ParamCall['fn']) => this.calls.filter((c) => c.fn === fn).map((c) => c.args)
}

export interface FakeNode {
  kind: string
  connections: FakeNode[]
  starts: number[][]
  stops: number[][]
  disconnected: number
  /** Si défini, `stop()` lève cette erreur (source déjà arrêtée). */
  stopThrows?: boolean
  onended?: () => void
  type?: string
  buffer?: unknown
  curve?: unknown
  [k: string]: unknown
}

/** Paramètre d’un nœud (`node.gain`, `node.frequency`…), créé à la demande. */
export const param = (n: FakeNode, name: string): FakeParam => n[name] as FakeParam

export const makeNode = (kind: string): FakeNode => {
  const target: FakeNode = {
    kind,
    connections: [],
    starts: [],
    stops: [],
    disconnected: 0,
  }
  const methods = {
    connect: (n: FakeNode) => {
      target.connections.push(n)
      return n
    },
    disconnect: () => void target.disconnected++,
    start: (...a: number[]) => void target.starts.push(a),
    stop: (...a: number[]) => {
      if (target.stopThrows) throw new Error('InvalidStateError')
      target.stops.push(a)
    },
  }
  return new Proxy(target, {
    get: (t, k) => {
      if (typeof k === 'symbol') return undefined
      if (k in methods) return methods[k as keyof typeof methods]
      if (k in t) return t[k]
      return (t[k] = new FakeParam())
    },
    set: (t, k: string, v) => ((t[k] = v), true),
  })
}

export class FakeCtx {
  static instances: FakeCtx[] = []
  state = 'running'
  currentTime = 0
  sampleRate = 8000
  baseLatency = 0.01
  outputLatency = 0
  destination = makeNode('destination')
  nodes: FakeNode[] = []
  resume = () => Promise.resolve()
  buffersCreated = 0
  constructor() {
    FakeCtx.instances.push(this)
  }
  private mk = (kind: string) => {
    const n = makeNode(kind)
    this.nodes.push(n)
    return n
  }
  createGain = () => this.mk('gain')
  createOscillator = () => this.mk('oscillator')
  createBiquadFilter = () => this.mk('biquad')
  createBufferSource = () => this.mk('bufferSource')
  createDynamicsCompressor = () => this.mk('compressor')
  createConvolver = () => this.mk('convolver')
  createWaveShaper = () => this.mk('shaper')
  createBuffer = (channels: number, length: number, rate: number) => {
    this.buffersCreated++
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return { numberOfChannels: channels, length, sampleRate: rate, duration: length / rate, getChannelData: (i: number) => data[i] }
  }
  /** Nœuds d’un type donné créés depuis le début. */
  all = (kind: string) => this.nodes.filter((n) => n.kind === kind)
}
