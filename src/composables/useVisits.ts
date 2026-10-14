import { paranoiaLevel } from '../engine/paranoia'

const KEY = 'rvj-visits'

export const readVisits = (): number => {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isInteger(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/** Increment the persisted door-reopen counter; returns the new value. */
export const bumpVisits = (): number => {
  const n = readVisits() + 1
  try {
    localStorage.setItem(KEY, String(n))
  } catch {
    /* ignore */
  }
  return n
}

export const levelForVisits = (visits: number) => paranoiaLevel(visits)

/** Back to 0 visits (level 1). Shuffle bags are left alone. */
export const resetVisits = (): void => {
  try {
    localStorage.setItem(KEY, '0')
  } catch {
    /* ignore */
  }
}
