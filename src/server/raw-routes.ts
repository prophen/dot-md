/**
 * GET /<handle>.md — a published profile as plain markdown, for agents.
 *
 * Reads the record room with RBAC off (the same channel server actions use),
 * so this route is the access check: only `status: 'published'` rows leave.
 */

import type { Hono } from 'hono'
import type { AppContext } from '../../worker.js'

export function registerRawRoutes(app: Hono<AppContext>): void {
  app.get('/:file{[a-z0-9-]+\\.md}', async (c) => {
    const handle = c.req.param('file').slice(0, -3)
    const stub = c.env.RECORD_ROOMS.get(c.env.RECORD_ROOMS.idFromName(`app:${c.env.DEEPSPACE_APP_ID}`))
    const res = await stub.fetch(
      new Request('https://internal/api/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': c.env.OWNER_USER_ID,
          'X-App-Action': 'true',
        },
        body: JSON.stringify({
          tool: 'records.query',
          params: { collection: 'profiles', where: { handle, status: 'published' }, limit: 1 },
        }),
      }),
    )
    const result = (await res.json()) as {
      success: boolean
      data?: { records: Array<{ data: { body: string }; updatedAt?: string }> }
    }
    const record = result.success ? result.data?.records[0] : undefined
    if (!record) {
      return c.text(`${handle}.md: No such file\n`, 404, { 'Content-Type': 'text/plain; charset=utf-8' })
    }
    const headers: Record<string, string> = {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    }
    if (record.updatedAt) headers['Last-Modified'] = new Date(record.updatedAt).toUTCString()
    return c.body(record.data.body.endsWith('\n') ? record.data.body : `${record.data.body}\n`, 200, headers)
  })
}
