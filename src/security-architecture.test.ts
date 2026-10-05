import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
  })
}

describe('server authorization architecture', () => {
  it('requires API-key authentication on every public v1 route', () => {
    const root = join(__dirname, 'app', 'api', 'v1')
    const routes = walk(root).filter(
      (path) => path.endsWith('route.ts') && !path.endsWith('.test.ts'),
    )

    expect(routes.length).toBeGreaterThan(0)

    const missing = routes.filter(
      (path) => !readFileSync(path, 'utf8').includes('requireApiKey('),
    )
    const privilegedImports = routes.filter((path) => {
      const source = readFileSync(path, 'utf8')
      return (
        source.includes('@/lib/supabase/admin') ||
        source.includes('@/lib/automations/admin-client') ||
        source.includes('@/lib/flows/admin-client')
      )
    })

    expect(missing).toEqual([])
    expect(privilegedImports).toEqual([])
  })

  it('keeps the Supabase secret key behind the server-only boundary', () => {
    const root = join(__dirname, '..')
    const offenders = walk(root)
      .filter((path) => !path.endsWith('server-env.ts'))
      .filter((path) => {
        const source = readFileSync(path, 'utf8')
        return (
          source.includes('process.env.SUPABASE_SECRET_KEY') ||
          source.includes('process.env.SUPABASE_SERVICE_ROLE_KEY')
        )
      })

    expect(offenders).toEqual([])
  })

  it('does not import a privileged Supabase client into client components', () => {
    const root = join(__dirname, '..')
    const offenders = walk(root).filter((path) => {
      const source = readFileSync(path, 'utf8')
      if (!source.includes('"use client"') && !source.includes("'use client'")) {
        return false
      }
      return (
        source.includes('@/lib/supabase/admin') ||
        source.includes('@/lib/automations/admin-client') ||
        source.includes('@/lib/flows/admin-client')
      )
    })

    expect(offenders).toEqual([])
  })
})
