import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Hono } from 'hono'
import type { AppContext, Env } from '../../worker'
import type { Profile } from '../schemas/profiles-schema'
import { buildProfileTools } from '../ai/profile-tools'
import { SourceView } from '../components/SourceView'
import { registerRawRoutes } from './raw-routes'
import { searchProfiles } from './profile-search'
import { readOpportunities } from '../lib/opportunities'

describe('opportunities across agent editing and public surfaces', () => {
  it('uses the saved Markdown and respects draft/unlisted/listed transitions and clearing', async () => {
    const custom = '# Ada\n\nBuilds tools.\n\n## Custom\nPreserve *every* word.\n'
    const row: Profile = { handle: 'ada', name: 'Ada', tagline: 'Builds tools.', kind: 'person', status: 'draft', body: custom }
    let owner = 'owner'
    const executor = async (tool: string, params: Record<string, unknown>) => {
      if (tool === 'records.update') Object.assign(row, params.data)
      return { success: true, data: { records: [{ recordId: 'id', createdBy: owner, data: row }] } }
    }
    const tools = buildProfileTools(executor, { userId: 'owner', origin: 'https://example.com' })
    const invoke = (tool: string, input: unknown) => tools[tool].execute!(input, { toolCallId: 'test', messages: [], context: undefined })
    const env = { OWNER_USER_ID: 'owner', DEEPSPACE_APP_ID: 'test', RECORD_ROOMS: {
      idFromName: (s: string) => s, get: () => ({ fetch: async () => Response.json({ success: true, data: { records: [{ data: row }] } }) }),
    } } as unknown as Env
    const app = new Hono<AppContext>(); registerRawRoutes(app)
    await invoke('update_opportunities', { handle: 'ada', openTo: ['contracts', 'mentoring'], availability: 'January', workPreferences: 'Remote' })
    expect(row.body.startsWith(custom)).toBe(true)
    expect(row.status).toBe('draft')
    expect(await invoke('read_file', { handle: 'ada' })).toMatchObject({ markdown: row.body, opportunities: { value: { openTo: ['contracts', 'mentoring'] } } })
    for (const status of ['draft', 'unlisted', 'published', 'unlisted', 'draft'] as const) {
      row.status = status
      const raw = await app.request('/ada.md', {}, env)
      const publicJson = await app.request('/api/public/profiles/ada', {}, env)
      expect(raw.status).toBe(status === 'draft' ? 404 : 200)
      expect(publicJson.status).toBe(raw.status)
      expect(raw.headers.get('Cache-Control')).toBe('no-store')
      if (status !== 'draft') {
        expect(await raw.text()).toBe(row.body)
        expect(await publicJson.json()).toMatchObject({ data: { body: row.body } })
        expect(renderToStaticMarkup(<SourceView body={row.body} />)).toContain('contracts, mentoring')
      }
      if (status === 'unlisted') expect(raw.headers.get('X-Robots-Tag')).toBe('noindex')
      const found = await searchProfiles(env, 'https://example.com', { query: 'mentoring Remote' })
      expect(found.results).toHaveLength(status === 'published' ? 1 : 0)
    }
    await invoke('update_file', { handle: 'ada', markdown: row.body.replace('contracts, mentoring', 'speaking') })
    expect(readOpportunities(row.body).value.openTo).toEqual(['speaking'])
    row.status = 'published'
    await invoke('update_opportunities', { handle: 'ada', openTo: [], availability: '', workPreferences: '' })
    expect(row.status).toBe('published')
    expect(row.body.trimEnd()).toBe(custom.trimEnd())
    expect((await searchProfiles(env, 'https://example.com', { query: 'speaking' })).results).toEqual([])
    expect(await (await app.request('/ada.md', {}, env)).text()).not.toContain('Opportunities')
    owner = 'someone-else'
    await expect(invoke('update_opportunities', { handle: 'ada', openTo: ['jobs'], availability: '', workPreferences: '' })).rejects.toThrow(/don't have/)
  })
})
