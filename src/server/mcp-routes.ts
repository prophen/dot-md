/**
 * dot-md's MCP endpoint for people's own agents:
 *
 *   POST /agent/mcp          MCP (Streamable HTTP, stateless JSON responses)
 *   GET  /agent/tools.md     the same tools, documented for agents
 *   POST /agent/tools/:name  plain HTTP, {"input": {...}}
 *
 * The transport is the SDK's; this file only decides who is calling. A
 * caller presents `Authorization: Bearer dmd_…`, a personal access token
 * minted on the "your files" page. Its hash is looked up with RBAC off,
 * then the tools run as the token's owner with normal RBAC on.
 */

import type { Hono } from 'hono'
import { createUserToolExecutor, registerAgentToolTransports } from 'deepspace/worker'
import { buildTools } from '../ai/tools.js'
import type { ApiToken } from '../schemas/api-tokens-schema.js'
import { TOKEN_PREFIX, hashToken } from './tokens.js'
import type { AppContext, Env } from '../../worker.js'

/** Don't write lastUsedAt on every call; once an hour is enough to be useful. */
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000

function unauthorized(message: string): Response {
  return new Response(JSON.stringify({ ok: false, code: 'unauthenticated', error: message }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'WWW-Authenticate': 'Bearer realm="dot-md"',
    },
  })
}

async function appTool(env: Env, tool: string, params: Record<string, unknown>) {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const res = await stub.fetch(
    new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': env.OWNER_USER_ID, 'X-App-Action': 'true' },
      body: JSON.stringify({ tool, params }),
    }),
  )
  return (await res.json()) as { success: boolean; data?: { records?: Array<{ recordId: string; data: ApiToken }> } }
}

async function tokenOwner(env: Env, request: Request): Promise<string | Response> {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token.startsWith(TOKEN_PREFIX)) {
    return unauthorized('Send a dot-md personal access token: Authorization: Bearer dmd_…. Create one on the "your files" page.')
  }
  const result = await appTool(env, 'records.query', {
    collection: 'api_tokens',
    where: { tokenHash: await hashToken(token) },
    limit: 1,
  })
  const record = result.success ? result.data?.records?.[0] : undefined
  if (!record) return unauthorized('That token is not valid. It may have been revoked.')

  const last = record.data.lastUsedAt ? Date.parse(record.data.lastUsedAt) : 0
  if (Date.now() - last > LAST_USED_RESOLUTION_MS) {
    await appTool(env, 'records.update', {
      collection: 'api_tokens',
      recordId: record.recordId,
      data: { lastUsedAt: new Date().toISOString() },
    })
  }
  return record.data.ownerId
}

export function registerMcpRoutes(app: Hono<AppContext>): void {
  registerAgentToolTransports(app, {
    basePath: '/agent',
    describe: (env) => ({ id: env.DEEPSPACE_APP_ID, name: env.APP_NAME }),
    resolveTools: async (request, env) => {
      const owner = await tokenOwner(env as Env, request)
      if (owner instanceof Response) return owner
      return buildTools(createUserToolExecutor(env as Env, owner, request.signal), {
        env: env as Env,
        userId: owner,
        request,
      })
    },
  })
}
