import { describe, expect, it } from 'vitest'
import {
  AMPLITUDE,
  FREE_DAMPING,
  HALF_ARC,
  heldSymbol,
  launch,
  paramsFor,
  periodFactor,
  pickSymbols,
  pickTarget,
  pushDir,
  requestStop,
  restAngle,
  stepPendulum,
  swingPeriod,
  symbolAngle,
  symbolSpacing,
  tuningFor,
  w2ForPeriod,
  type PendulumParams,
  type PendulumState,
} from '@/engine/pendulum'
import { mulberry32 } from '@/engine/rng'

const DT = 1 / 120
// Fait avancer l’état de `s` secondes, par images de DT.
const run = (state: PendulumState, p: PendulumParams, s: number) => {
  let st = state
  for (let t = 0; t < s - 1e-9; t += DT) st = stepPendulum(st, DT, p)
  return st
}
// Durée moyenne (s) entre deux passages à zéro dans le même sens, sur `n` périodes.
const measuredPeriod = (state: PendulumState, p: PendulumParams, n = 4) => {
  let st = state
  const crossings: number[] = []
  for (let t = 0; crossings.length <= n && t < 60; t += DT / 4) {
    const next = stepPendulum(st, DT / 4, p)
    if (st.theta < 0 && next.theta >= 0) crossings.push(t + (DT / 4) * (-st.theta / (next.theta - st.theta)))
    st = next
  }
  return (crossings.at(-1)! - crossings[0]) / n
}
const undamped = (p: PendulumParams): PendulumParams => ({ ...p, free: 0 })

describe('pendule : période', () => {
  it('aux petites amplitudes, T = 2π / √(g/L)', () => {
    const p = undamped(paramsFor(tuningFor(3)))
    const s = launch(p, 0.03, 0, -1)
    expect(measuredPeriod({ ...s, theta: -0.0001, omega: 0.03 * Math.sqrt(p.w2) }, p)).toBeCloseTo((2 * Math.PI) / Math.sqrt(p.w2), 2)
    expect(periodFactor(0.03)).toBeCloseTo(1, 3)
  })

  it('à grande amplitude, la période allonge comme le prédit la formule exacte (moyenne arithmético-géométrique)', () => {
    const p = undamped(paramsFor(tuningFor(2)))
    const measured = measuredPeriod(launch(p, AMPLITUDE, 0, 1), p)
    expect(measured / swingPeriod(p.w2, AMPLITUDE)).toBeCloseTo(1, 2)
    expect(periodFactor(AMPLITUDE)).toBeGreaterThan(1.1)
  })

  it('w2ForPeriod règle la période réelle (pas celle des petites oscillations), à chaque niveau', () => {
    for (const level of [2, 3, 4, 5]) {
      const t = tuningFor(level)
      expect(swingPeriod(w2ForPeriod(t.period, AMPLITUDE), AMPLITUDE)).toBeCloseTo(t.period, 9)
      const p = undamped(paramsFor(t))
      expect(measuredPeriod(launch(p, AMPLITUDE, 0, 1), p) / t.period).toBeCloseTo(1, 2)
    }
  })

  it('mouvement réduit : période allongée de moitié', () => {
    const t = tuningFor(4)
    expect(swingPeriod(paramsFor(t, true).w2, AMPLITUDE) / swingPeriod(paramsFor(t).w2, AMPLITUDE)).toBeCloseTo(1.5, 9)
  })
})

describe('pendule : amortissement', () => {
  it('libre : très faible, l’amplitude reste assez grande après toute l’activité pour atteindre les symboles des extrémités', () => {
    const p = paramsFor(tuningFor(5))
    let s = launch(p, AMPLITUDE, 0, 1)
    let max = 0
    for (let t = 0; t < 18; t += DT) {
      s = stepPendulum(s, DT, p)
      if (t > 18 - p.w2 ** -0.5 * 8) max = Math.max(max, Math.abs(s.theta))
    }
    expect(FREE_DAMPING).toBeLessThan(0.03)
    expect(max).toBeGreaterThan(HALF_ARC)
    expect(max).toBeLessThan(AMPLITUDE)
  })

  it('sans amortissement, l’énergie se conserve : l’amplitude ne bouge pas', () => {
    const p = undamped(paramsFor(tuningFor(3)))
    let s = launch(p, AMPLITUDE, 0, 1)
    let max = 0
    for (let t = 0; t < 30; t += DT) {
      s = stepPendulum(s, DT, p)
      max = Math.max(max, Math.abs(s.theta))
    }
    expect(max).toBeCloseTo(AMPLITUDE, 1)
  })

  it('l’arrêt freine fort : immobile en moins d’une seconde, vitesse nulle', () => {
    const p = paramsFor(tuningFor(3))
    const s = run(requestStop(launch(p, AMPLITUDE, 0, 1)), p, 1)
    expect(s.rest).toBe(true)
    expect(s.omega).toBe(0)
  })

  it('l’arrêt n’est pas un retour au centre : le cristal glisse dans son sens de marche puis reste où il est', () => {
    const p = paramsFor(tuningFor(3))
    const start = run(launch(p, AMPLITUDE, 0, 1), p, 0.2)
    expect(start.omega).toBeGreaterThan(0)
    const rest = restAngle(start, p)
    expect(rest).toBeGreaterThan(start.theta + 0.1) // il glisse encore
    expect(rest).toBeLessThan(AMPLITUDE)
    const end = run(requestStop(start), p, 2)
    expect(end.rest).toBe(true)
    expect(end.theta).toBeCloseTo(rest, 9) // il reste là où il s’est arrêté, il ne retourne pas à zéro
    expect(Math.abs(end.theta)).toBeGreaterThan(0.2)
  })

  it('arrêté près d’un point de rebroussement (vitesse faible), il s’immobilise tout de suite', () => {
    const p = paramsFor(tuningFor(3))
    const s = launch(p, AMPLITUDE, AMPLITUDE - 0.001, 1)
    const r = stepPendulum(requestStop(s), DT, p)
    expect(r.rest).toBe(true)
    expect(r.theta).toBeCloseTo(AMPLITUDE - 0.001, 3)
  })

  it('un état immobile ne bouge plus, un pas nul ou négatif non plus', () => {
    const p = paramsFor(tuningFor(3))
    const rest = run(requestStop(launch(p, AMPLITUDE, 0, 1)), p, 1)
    expect(stepPendulum(rest, 1, p)).toBe(rest)
    const s = launch(p, AMPLITUDE, 0, 1)
    expect(stepPendulum(s, 0, p)).toBe(s)
    expect(stepPendulum(s, -1, p)).toBe(s)
  })

  it('le résultat ne dépend pas de la cadence d’affichage (pas fixes en interne)', () => {
    const p = paramsFor(tuningFor(4))
    const a = run(launch(p, AMPLITUDE, 0, 1), p, 1.5)
    let b = launch(p, AMPLITUDE, 0, 1)
    for (let i = 0; i < 90; i++) b = stepPendulum(b, 1.5 / 90, p)
    expect(b.theta).toBeCloseTo(a.theta, 2)
  })
})

describe('pendule : lancement et relance', () => {
  it('lancé de repos à un angle avec l’énergie d’un balancement complet, il atteint l’amplitude voulue', () => {
    const p = undamped(paramsFor(tuningFor(3)))
    const theta0 = 0.8
    let s = launch(p, AMPLITUDE, theta0, pushDir(theta0))
    expect(s.theta).toBe(theta0) // la position ne saute pas
    let max = 0
    for (let t = 0; t < 8; t += DT) {
      s = stepPendulum(s, DT, p)
      max = Math.max(max, Math.abs(s.theta))
    }
    expect(max).toBeCloseTo(AMPLITUDE, 1)
  })

  it('la poussée va vers le côté où il y a le plus de place', () => {
    expect(pushDir(0.5)).toBe(-1)
    expect(pushDir(-0.5)).toBe(1)
    expect(pushDir(0)).toBe(1)
  })
})

describe('pendule : symboles', () => {
  it('répartis également sur l’arc, symétriques', () => {
    for (const n of [5, 6, 7, 8]) {
      expect(symbolAngle(0, n)).toBeCloseTo(-HALF_ARC, 9)
      expect(symbolAngle(n - 1, n)).toBeCloseTo(HALF_ARC, 9)
      expect(symbolAngle(1, n) - symbolAngle(0, n)).toBeCloseTo(symbolSpacing(n), 9)
      expect(symbolAngle(1, n) + symbolAngle(n - 2, n)).toBeCloseTo(0, 9)
    }
  })

  it('le cristal immobile sur un symbole le retient, à chaque niveau', () => {
    for (const level of [2, 3, 4, 5]) {
      const { count, ratio } = tuningFor(level)
      for (let i = 0; i < count; i++) expect(heldSymbol(symbolAngle(i, count), count, ratio)).toBe(i)
    }
  })

  it('tolérance : entre deux symboles, retenu à 0,5 (zones jointives) mais pas à 0,4', () => {
    const n = 6
    const mid = (symbolAngle(2, n) + symbolAngle(3, n)) / 2
    expect(heldSymbol(mid - 0.01, n, 0.5)).toBe(2)
    expect(heldSymbol(mid + 0.01, n, 0.5)).toBe(3)
    expect(heldSymbol(mid, n, 0.4)).toBeNull()
    const d = 0.4 * symbolSpacing(n)
    expect(heldSymbol(symbolAngle(2, n) + d - 0.001, n, 0.4)).toBe(2)
    expect(heldSymbol(symbolAngle(2, n) + d + 0.001, n, 0.4)).toBeNull()
  })

  it('hors de l’arc : aucun symbole, même près de l’extrémité', () => {
    const { count, ratio } = tuningFor(5)
    expect(heldSymbol(AMPLITUDE, count, ratio)).toBeNull()
    expect(heldSymbol(-AMPLITUDE, count, ratio)).toBeNull()
    expect(heldSymbol(0, 0, 0.5)).toBeNull()
  })

  it('pickSymbols : distincts, bon nombre, déterministes avec la graine ; pickTarget dans l’intervalle', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const a = pickSymbols(mulberry32(3), pool, 6)
    expect(a).toHaveLength(6)
    expect(new Set(a).size).toBe(6)
    expect(pickSymbols(mulberry32(3), pool, 6)).toEqual(a)
    expect(pool).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) // le paquet d’origine n’est pas touché
    const rng = mulberry32(9)
    for (let i = 0; i < 200; i++) expect(pickTarget(rng, 7)).toBeGreaterThanOrEqual(0)
    expect(pickTarget(() => 0.999999, 7)).toBe(6)
  })
})

describe('pendule : aimant', () => {
  const level = 4
  const t = tuningFor(level)
  const target = 3
  const aim = symbolAngle(target, t.count)
  const withMagnet = paramsFor(t, false, target)
  // Arrête à l’instant où le crâne d’arrêt (simulation à blanc) tombe à `offset` rad du symbole visé ; rend l’état au moment de l’appui.
  const stopNear = (offset: number) => {
    let s = launch(withMagnet, AMPLITUDE, 0, 1)
    const noMagnet = paramsFor(t)
    for (let time = 0; time < 12; time += 0.002) {
      s = stepPendulum(s, 0.002, withMagnet)
      if (s.omega > 0.5 && Math.abs(restAngle(s, noMagnet) - (aim + offset)) < 0.004) return s
    }
    throw new Error('aucun instant d’arrêt trouvé')
  }

  it('près du symbole visé, le cristal se cale dessus en glissant visiblement (plusieurs images, mouvement continu)', () => {
    const s0 = stopNear(0.5 * 0.5 * symbolSpacing(t.count)) // un quart d’espacement à côté
    let s = requestStop(s0)
    const thetas: number[] = []
    let snapped = false
    for (let i = 0; i < 600 && !s.rest; i++) {
      s = stepPendulum(s, DT, withMagnet)
      if (s.snapTo !== null) snapped = true
      thetas.push(s.theta)
    }
    expect(snapped).toBe(true)
    expect(s.rest).toBe(true)
    expect(s.theta).toBe(aim)
    // Plus de 10 images de glissade avec des pas bien plus petits que la distance : un glissement, pas un saut.
    const steps = thetas.slice(1).map((v, i) => Math.abs(v - thetas[i]))
    expect(thetas.length).toBeGreaterThan(10)
    expect(Math.max(...steps)).toBeLessThan(0.2 * symbolSpacing(t.count))
    expect(heldSymbol(s.theta, t.count, t.ratio)).toBe(target)
  })

  it('hors de portée (à plus de `pull` espacements), aucun aimant : il reste où il s’est arrêté', () => {
    const s0 = stopNear(0.5 * symbolSpacing(t.count) + 0.01)
    let s = requestStop(s0)
    let snapped = false
    for (let i = 0; i < 600 && !s.rest; i++) {
      s = stepPendulum(s, DT, withMagnet)
      if (s.snapTo !== null) snapped = true
    }
    expect(snapped).toBe(false)
    expect(s.theta).not.toBeCloseTo(aim, 2)
  })

  it('sans cible (paramsFor sans indice), l’aimant n’existe pas', () => {
    expect(paramsFor(t).magnet).toBeUndefined()
    expect(withMagnet.magnet?.angle).toBeCloseTo(aim, 9)
    expect(withMagnet.magnet?.reach).toBeCloseTo(t.pull * symbolSpacing(t.count), 9)
  })

  it('la glissade après l’arrêt est courte (moins d’un demi-espacement au plus fort) et prévisible : ≈ vitesse ÷ amortissement', () => {
    for (const lv of [2, 3, 4, 5]) {
      const tn = tuningFor(lv)
      const p = paramsFor(tn)
      const s = run(launch(p, AMPLITUDE, 0, 1), p, 0.3)
      const slide = Math.abs(restAngle(s, p) - s.theta)
      expect(slide).toBeLessThan(0.5 * symbolSpacing(tn.count))
      expect(slide).toBeCloseTo((Math.abs(s.omega) - p.hold) / p.stop, 1)
    }
  })
})

describe('pendule : niveaux', () => {
  // Adapté à l’assouplissement : le nombre de symboles ne croît plus à chaque niveau (5, 6, 6, 7), la tolérance reste large (portée de l’aimant ≥ 0,45 espacement).
  it('plus on monte, plus il y a de symboles (jamais moins), plus c’est rapide et plus l’aimant se resserre ; le niveau 5 reste indulgent', () => {
    const ts = [2, 3, 4, 5].map(tuningFor)
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i].count).toBeGreaterThanOrEqual(ts[i - 1].count)
      expect(ts[i].period).toBeLessThan(ts[i - 1].period)
      expect(ts[i].pull).toBeLessThanOrEqual(ts[i - 1].pull)
      expect(ts[i].ratio).toBeLessThanOrEqual(ts[i - 1].ratio)
    }
    expect(ts[3].count).toBeGreaterThan(ts[0].count)
    expect(ts[3].count).toBeLessThanOrEqual(7)
    expect(ts[3].period).toBeGreaterThanOrEqual(3.4)
    for (const t of ts) {
      expect(t.tries).toBeGreaterThanOrEqual(1)
      expect(t.tries).toBeLessThanOrEqual(2)
      expect(t.pull).toBeGreaterThanOrEqual(t.ratio) // l’aimant couvre au moins la zone du symbole
      expect(t.pull).toBeGreaterThanOrEqual(0.45)
    }
  })

  it('niveau borné à [2 ; 5]', () => {
    expect(tuningFor(1)).toEqual(tuningFor(2))
    expect(tuningFor(9)).toEqual(tuningFor(5))
  })

  it('jouable : chaque symbole de chaque niveau a une fenêtre d’arrêt d’au moins 40 ms par passage (les deux sens comptés à part)', () => {
    for (const level of [2, 3, 4, 5]) {
      const t = tuningFor(level)
      const p = paramsFor(t)
      const step = 0.004
      const holds: (number | null)[] = []
      let s = launch(p, AMPLITUDE, 0, 1)
      for (let time = 0; time < 2 * t.period; time += step) {
        holds.push(heldSymbol(restAngle(s, p), t.count, t.ratio))
        s = stepPendulum(s, step, p)
      }
      for (let target = 0; target < t.count; target++) {
        // plus longue suite continue de pas qui retiennent la cible
        let best = 0
        let run = 0
        for (const h of holds) {
          run = h === target ? run + 1 : 0
          best = Math.max(best, run)
        }
        expect(best * step * 1000, `niveau ${level}, symbole ${target}`).toBeGreaterThanOrEqual(40)
      }
    }
  })
})

// Simulation de parties (mulberry32, 500 par niveau). Le joueur anticipe : il vise le milieu de la fenêtre d’arrêt gagnante la plus proche
// (après un délai de réaction aléatoire), avec une imprécision gaussienne `sd` (s) ; le joueur « au hasard » appuie à un instant uniforme.
const GAMES = 500
const gauss = (rng: () => number) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng())
const simulate = (level: number, mode: { sd: number } | 'random', seed: number) => {
  const rng = mulberry32(seed)
  const t = tuningFor(level)
  let first = 0
  let any = 0
  for (let g = 0; g < GAMES; g++) {
    const target = Math.floor(rng() * t.count)
    const p = paramsFor(t, false, target)
    let s = launch(p, AMPLITUDE)
    let won = false
    for (let tr = 0; tr < t.tries && !won; tr++) {
      let press: number
      if (mode === 'random') press = rng() * 2 * t.period
      else {
        // Fenêtres gagnantes : instants où l’arrêt (simulation à blanc) tombe dans la zone du symbole visé.
        const wins: boolean[] = []
        let probe = s
        for (let time = 0; time < 2 * t.period; time += 0.01) {
          wins.push(heldSymbol(restAngle(probe, p), t.count, t.ratio) === target)
          probe = stepPendulum(probe, 0.01, p)
        }
        const from = Math.floor((0.3 + rng() * 0.5 * t.period) / 0.01)
        press = from * 0.01
        for (let i = from; i < wins.length; i++) {
          if (!wins[i]) continue
          let j = i
          while (j < wins.length && wins[j]) j++
          press = ((i + j - 1) / 2) * 0.01
          break
        }
        press += gauss(rng) * mode.sd
      }
      press = Math.max(0.05, press)
      for (let time = 0; time < press; time += DT) s = stepPendulum(s, Math.min(DT, press - time), p)
      s = requestStop(s)
      for (let time = 0; time < 4 && !s.rest; time += DT) s = stepPendulum(s, DT, p)
      won = heldSymbol(s.theta, t.count, t.ratio) === target
      if (won) {
        any++
        if (tr === 0) first++
      } else s = launch(p, AMPLITUDE, s.theta, pushDir(s.theta))
    }
  }
  return { first: first / GAMES, any: any / GAMES }
}

describe('pendule : difficulté simulée (500 parties par niveau, imprécision d’appui de 80 ms)', () => {
  // Cibles : 92 % / 85 % / 80 % / 75 % au premier essai (niveaux 2 à 5), ≥ 95 % avec les 2 essais ; marge de ±5 points pour le bruit d’échantillonnage.
  const goals: Record<number, number> = { 2: 0.92, 3: 0.85, 4: 0.8, 5: 0.75 }
  for (const level of [2, 3, 4, 5]) {
    it(`niveau ${level} : ≈ ${goals[level] * 100} % au premier essai, ≥ 93 % en deux essais, et un appui au hasard gagne rarement`, () => {
      const skilled = simulate(level, { sd: 0.08 }, 1)
      expect(skilled.first).toBeGreaterThan(goals[level] - 0.06)
      expect(skilled.first).toBeLessThan(goals[level] + 0.06)
      expect(skilled.any).toBeGreaterThanOrEqual(0.93)
      const random = simulate(level, 'random', 2)
      expect(random.any).toBeLessThanOrEqual(0.4) // au plus ≈ 35 % en deux essais, même au niveau le plus facile
      if (level === 5) expect(random.any).toBeLessThanOrEqual(0.35)
      expect(random.first).toBeLessThanOrEqual(0.25)
    }, 120_000)
  }
})
