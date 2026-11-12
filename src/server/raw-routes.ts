/**
 * Public routes that read published profiles on the server:
 *
 *   GET /<handle>.md   the file itself, as plain markdown, for agents.
 *   GET /p/<handle>    the app shell with that profile's title, description
 *                      and Open Graph tags stamped in, so link previews and
 *                      crawlers that don't run JavaScript see who it is.
 *
 * These routes read the record room with RBAC off (the same channel server actions
 * use), so these routes are the access check: only `published` or `unlisted`
 * rows leave. Responses are `no-store`: a cached copy would outlive an unpublish
 * or delete, and the check has to run on every request to mean anything.
 */

import type { Hono } from 'hono'
import exampleBody from '../examples/person.md?raw'
import type { Profile } from '../schemas/profiles-schema'
import type { AppContext, Env } from '../../worker.js'

interface PublishedProfile {
  data: Profile
  updatedAt?: string
}

async function findPublished(env: Env, handle: string): Promise<PublishedProfile | undefined> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const res = await stub.fetch(
    new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': env.OWNER_USER_ID,
        'X-App-Action': 'true',
      },
      body: JSON.stringify({
        tool: 'records.query',
        params: { collection: 'profiles', where: { handle }, limit: 1 },
      }),
    }),
  )
  const result = (await res.json()) as { success: boolean; data?: { records: PublishedProfile[] } }
  const record = result.success ? result.data?.records[0] : undefined
  return record && ['published', 'unlisted'].includes(record.data.status) ? record : undefined
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

/** The tags src/components/Seo.tsx would render, for one profile. */
function profileHead(profile: PublishedProfile, origin: string): string {
  const { handle, name, tagline } = profile.data
  const title = escapeHtml(`${name} · dot-md`)
  const description = escapeHtml(tagline || `${name}'s person.md — readable by people, fetchable by agents.`)
  const url = escapeHtml(`${origin}/p/${handle}`)
  const image = escapeHtml(`${origin}/og.png`)
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" type="text/markdown" href="${escapeHtml(`${origin}/${handle}.md`)}" />`,
    `<meta property="og:site_name" content="dot-md" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n    ')
}

export function registerRawRoutes(app: Hono<AppContext>): void {
  // Static fixture, outside the handle namespace and never stored as a profile.
  app.get('/example/person.md', (c) => c.body(exampleBody, 200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  }))

  // Exact-handle access only; never expose a privileged list/query endpoint.
  app.get('/api/public/profiles/:handle{[a-z0-9-]+}', async (c) => {
    c.header('Cache-Control', 'no-store')
    const record = await findPublished(c.env, c.req.param('handle'))
    if (!record) return c.json({ error: 'Not found' }, 404)
    if (record.data.status === 'unlisted') c.header('X-Robots-Tag', 'noindex')
    // Deliberately omit ownership and internal record metadata.
    return c.json({ data: record.data, updatedAt: record.updatedAt })
  })

  app.get('/:file{[a-z0-9-]+\\.md}', async (c) => {
    c.header('Cache-Control', 'no-store')
    const handle = c.req.param('file').slice(0, -3)
    const record = await findPublished(c.env, handle)
    if (!record) {
      return c.text(`${handle}.md: No such file\n`, 404, { 'Content-Type': 'text/plain; charset=utf-8' })
    }
    const headers: Record<string, string> = {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    }
    if (record.data.status === 'unlisted') headers['X-Robots-Tag'] = 'noindex'
    if (record.updatedAt) headers['Last-Modified'] = new Date(record.updatedAt).toUTCString()
    return c.body(record.data.body.endsWith('\n') ? record.data.body : `${record.data.body}\n`, 200, headers)
  })

  // Same shell lookup as registerStaticRoutes' fallback; anything unexpected
  // falls through to it, so this route can only add tags, never break a page.
  app.get('/p/:handle{[a-z0-9-]+}', async (c, next) => {
    const url = new URL(c.req.url)
    url.pathname = '/_spa'
    const shell = await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
    if (!shell.ok) return next()

    const record = await findPublished(c.env, c.req.param('handle'))
    if (!record) return next()

    const html = (await shell.text())
      .replace(/<title>[^<]*<\/title>/, '')
      .replace('</head>', `  ${profileHead(record, url.origin)}\n  </head>`)
    const headers = new Headers(shell.headers)
    // The shell's ETag names the generic page, not this profile's version of it.
    headers.delete('content-length')
    headers.delete('etag')
    headers.set('Content-Type', 'text/html; charset=utf-8')
    headers.set('Cache-Control', 'no-store')
    if (record.data.status === 'unlisted') headers.set('X-Robots-Tag', 'noindex')
    return new Response(html, { status: 200, headers })
  })
}
