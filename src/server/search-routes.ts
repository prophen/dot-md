import type { Hono } from 'hono'
import type { AppContext } from '../../worker'
import { searchInput, searchProfiles } from './profile-search'

export function registerSearchRoutes(app: Hono<AppContext>): void {
  app.get('/api/public/search', async (c) => {
    c.header('Cache-Control', 'no-store')
    const params = new URL(c.req.url).searchParams
    const input = searchInput.safeParse({
      query: params.get('query'),
      limit: params.has('limit') ? Number(params.get('limit')) : undefined,
    })
    if (!input.success || [...params.keys()].some((key) => !['query', 'limit'].includes(key) || params.getAll(key).length > 1)) {
      return c.json({ error: 'invalid_input', message: 'Use query (1–200 characters, at most five keywords, 80 characters each) and optional integer limit (1–20). No other or repeated parameters.' }, 400)
    }
    try {
      return c.json(await searchProfiles(c.env, new URL(c.req.url).origin, input.data))
    } catch {
      return c.json({ error: 'search_unavailable' }, 503)
    }
  })
}
