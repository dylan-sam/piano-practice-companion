// Windows and macOS file names ignore letter case: where two files of a folder differ only in
// case (effects.ts and Effects.tsx), an import of './Effects' without an extension opens
// effects.ts there (TypeScript tries .ts before .tsx), while it works on Linux. Such imports must
// name the file with its extension.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..')
const CODE = /\.(ts|tsx)$/

/** Every code file under a folder. */
function codeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return codeFiles(path)
    return CODE.test(name) ? [path] : []
  })
}

/** The relative module paths a file imports (static and dynamic imports, re-exports). */
function importsOf(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.[^'"]+)['"]/g)].map((match) => match[1])
}

/** Whether `stem` + .ts would open another file on a case-blind disk: a .ts file of the folder
 * has the same name in another case, and none has exactly this one. */
function opensAnother(dir: string, stem: string): boolean {
  const names = readdirSync(dir)
  return !names.includes(`${stem}.ts`) && names.some((name) => name.toLowerCase() === `${stem}.ts`.toLowerCase())
}

describe('file name casing', () => {
  it('names the extension when a file differs only in case from another of its folder', () => {
    const ambiguous: string[] = []
    for (const file of ['src', 'tests', 'scripts', 'e2e'].flatMap((dir) => codeFiles(join(ROOT, dir)))) {
      for (const spec of importsOf(readFileSync(file, 'utf8'))) {
        if (extname(spec)) continue
        const target = resolve(dirname(file), spec)
        if (opensAnother(dirname(target), basename(target))) ambiguous.push(`${file.slice(ROOT.length + 1)}: ${spec}`)
      }
    }
    expect(ambiguous).toEqual([])
  })
})
