import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../../src/stores/session'

describe('session store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('pulse bumps seq, records amp and a timestamp', () => {
    const s = useSessionStore()
    expect(s.knock).toEqual({ seq: 0, amp: 0, at: 0 })
    s.pulse()
    expect(s.knock.seq).toBe(1)
    expect(s.knock.amp).toBe(1)
    const first = s.knock.at
    expect(first).toBeGreaterThan(0)
    s.pulse(0.6)
    expect(s.knock.seq).toBe(2)
    expect(s.knock.amp).toBe(0.6)
    expect(s.knock.at).toBeGreaterThanOrEqual(first)
  })

  it('notify / dismiss manage balloons with unique ids', () => {
    const s = useSessionStore()
    expect(s.notifications).toEqual([])
    const a = s.notify('un')
    const b = s.notify('deux')
    expect(a).not.toBe(b)
    expect(s.notifications.map((n) => n.text)).toEqual(['un', 'deux'])
    s.dismiss(a)
    expect(s.notifications.map((n) => n.id)).toEqual([b])
  })

  describe('bulles retenues pendant une activité', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('retenues pendant l’activité, rendues environ 1 s après sa fin', () => {
      const s = useSessionStore()
      s.setActivityRunning(true)
      s.notify('Titre|Texte')
      expect(s.balloonsHeld).toBe(true)
      s.setActivityRunning(false)
      expect(s.balloonsHeld).toBe(true)
      vi.advanceTimersByTime(1000)
      expect(s.balloonsHeld).toBe(false)
      expect(s.notifications).toHaveLength(1)
    })

    it('une nouvelle activité annule la remise en cours', () => {
      const s = useSessionStore()
      s.setActivityRunning(true)
      s.setActivityRunning(false)
      s.setActivityRunning(true)
      vi.advanceTimersByTime(2000)
      expect(s.balloonsHeld).toBe(true)
    })
  })
})
