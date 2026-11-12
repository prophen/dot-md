import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppContext } from '../../worker'
import { registerRawRoutes } from './raw-routes'
import body from '../examples/person.md?raw'
import { readOpportunities } from '../lib/opportunities'

describe('static example source', () => {
  it('serves the exact shared Markdown anonymously without any database or auth bindings', async () => {
    const app = new Hono<AppContext>()
    registerRawRoutes(app)
    const response = await app.request('/example/person.md')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/markdown')
    expect(await response.text()).toBe(body)
  })

  it('demonstrates the supported optional opportunities format', () => {
    const parsed = readOpportunities(body)
    expect(parsed.error).toBeUndefined()
    expect(parsed.value.openTo).toEqual(['contracts', 'collaboration'])
  })
})
