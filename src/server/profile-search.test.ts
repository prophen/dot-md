import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Env, AppContext } from '../../worker'
import type { Profile } from '../schemas/profiles-schema'
import { searchInput, searchProfiles } from './profile-search'
import { registerSearchRoutes } from './search-routes'
import { buildTools } from '../ai/tools'

const profile = (handle: string, status: Profile['status'] = 'published'): Profile => ({
  handle, name: 'Ada', tagline: 'Database engineer', body: 'Builds accessible SQLite tools.', kind: 'person', status,
})
function fixture(rows: Profile[]) {
  const fetch = vi.fn(async (request: Request) => {
    const { params } = await request.json() as { params: { where: unknown } }
    expect(params.where).toEqual({ status: 'published' })
    // Intentionally return private records too: test the final safety check.
    return Response.json({ success: true, data: { records: rows.map((data) => ({ data, createdBy: 'owner', recordId: 'private-id' })) } })
  })
  const env = { OWNER_USER_ID: 'owner', DEEPSPACE_APP_ID: 'test', RECORD_ROOMS: { idFromName: (s: string) => s, get: () => ({ fetch }) } } as unknown as Env
  return { env, fetch }
}

describe('listed discovery', () => {
  it('matches all literal keywords across fields, includes bounded source evidence and URLs only', async () => {
    const row = profile('ada'); row.body = `${'x'.repeat(500)} SQLite ${'y'.repeat(500)}`
    const { env } = fixture([row, profile('draft', 'draft'), profile('unlisted', 'unlisted')])
    const response = await searchProfiles(env, 'https://dot-md.app.space', { query: 'ENGINEER SQLite' })
    expect(response.results).toHaveLength(1)
    expect(response.results[0]).toMatchObject({ handle: 'ada', listed: true, page: 'https://dot-md.app.space/p/ada', raw: 'https://dot-md.app.space/ada.md' })
    for (const item of response.results[0].evidence) {
      expect(item.excerpt.length).toBeLessThanOrEqual(160)
      expect(item.excerpt.toLowerCase()).toContain(item.keyword)
      expect(row[item.field]).toContain(item.excerpt)
    }
    expect(JSON.stringify(response)).not.toMatch(/private-id|createdBy|unlisted/)
    expect((await searchProfiles(env, 'https://example.com', { query: 'engineer absent' })).results).toEqual([])
    expect((await searchProfiles(env, 'https://example.com', { query: '.*' })).results).toEqual([])
  })

  it('keeps evidence aligned when Unicode lowercasing changes text length', async () => {
    const row = profile('unicode')
    row.body = `${'İ'.repeat(100)} SQLite ${'z'.repeat(300)}`
    const { env } = fixture([row])
    const found = await searchProfiles(env, 'https://example.com', { query: 'sqlite' })
    expect(found.results[0].evidence[0].excerpt).toContain('SQLite')
  })

  it('follows current listing transitions even for owner tools and preserves personal tools', async () => {
    const row = profile('ada', 'draft')
    const { env } = fixture([row])
    const executor = vi.fn(async () => ({ success: true, data: { records: [{ data: row, createdBy: 'owner' }] } }))
    const tools = buildTools(executor, { env, userId: 'owner', request: new Request('https://example.com/agent/mcp') })
    const invoke = (name: string, input: unknown) => tools[name].execute!(input, { toolCallId: 'test', messages: [], context: undefined })
    for (const status of ['draft', 'unlisted', 'published', 'unlisted', 'published', 'draft'] as const) {
      row.status = status
      const result = await invoke('search_profiles', { query: 'SQLite' }) as { results: unknown[] }
      expect(result.results).toHaveLength(status === 'published' ? 1 : 0)
      const mine = await invoke('list_my_files', {}) as { files: unknown[] }
      expect(mine.files).toHaveLength(1)
    }
    expect(await invoke('read_file', { handle: 'ada' })).toMatchObject({ status: 'draft', markdown: row.body })
    expect(tools.update_file.execute).toBeDefined()
    expect(tools.publish_file.execute).toBeDefined()
  })

  it('bounds results, follows database pagination, and discloses incomplete scans', async () => {
    const { env, fetch } = fixture([])
    fetch.mockImplementation(async (request) => {
      const { params } = await request.json() as { params: { offset: number } }
      return Response.json({ success: true, data: { records: [{ data: profile(`ada-${params.offset}`) }], nextOffset: params.offset + 1 } })
    })
    const limited = await searchProfiles(env, 'https://example.com', { query: 'SQLite', limit: 1 })
    expect(limited.results).toHaveLength(1)
    expect(limited.hasMore).toBe(true)
    fetch.mockClear()
    const incomplete = await searchProfiles(env, 'https://example.com', { query: 'absent' })
    expect(incomplete).toMatchObject({ results: [], scanTruncated: true, hasMore: false })
    expect(fetch).toHaveBeenCalledTimes(20)
  })

  it('validates HTTP requests, never caches results, and fails closed on storage errors', async () => {
    const { env, fetch } = fixture([profile('ada')])
    const app = new Hono<AppContext>(); registerSearchRoutes(app)
    for (const query of ['', '?query=', '?query=a&limit=0', '?query=a&limit=1.5', '?query=a&limit=21', '?query=a&status=draft', '?query=a&query=b', '?query=a+b+c+d+e+f']) {
      const response = await app.request(`/api/public/search${query}`, {}, env)
      expect(response.status).toBe(400)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
    }
    expect(fetch).not.toHaveBeenCalled()
    expect(searchInput.safeParse({ query: 'a'.repeat(201) }).success).toBe(false)
    expect(searchInput.safeParse({ query: 'a'.repeat(81) }).success).toBe(false)
    expect(searchInput.safeParse({ query: 'a', limit: '2' }).success).toBe(false)
    const response = await app.request('/api/public/search?query=sqlite', {}, env)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(((await response.json()) as { results: unknown[] }).results).toHaveLength(1)
    fetch.mockResolvedValue(Response.json({ success: false, error: 'secret internal error' }))
    const failure = await app.request('/api/public/search?query=sqlite', {}, env)
    expect(failure.status).toBe(503)
    expect(await failure.json()).toEqual({ error: 'search_unavailable' })
  })
})
