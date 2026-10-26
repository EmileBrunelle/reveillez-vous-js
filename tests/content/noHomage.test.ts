import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const BANNED = /terry|davis|templeos|holyc/i

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

describe('aucun hommage à Terry A. Davis / TempleOS', () => {
  it('ni le code, ni les fenêtres, ni le README, ni index.html ne le mentionnent', () => {
    const files = [...walk('src'), 'README.md', 'index.html']
    for (const f of files) {
      if (!/\.(vue|ts|svg|md|html|wgsl|css)$/.test(f)) continue
      expect(readFileSync(f, 'utf8'), f).not.toMatch(BANNED)
    }
  })
})
