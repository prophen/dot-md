import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { ApiToken } from '../schemas/api-tokens-schema'
import { hashToken, mintToken } from '../server/tokens'

const MAX_TOKENS = 10

export const actions: Record<string, ActionHandler<Env>> = {
  /**
   * Mint a personal access token for the MCP endpoint. Returns the token
   * once; only its hash is stored. Members can't create api_tokens rows
   * themselves, so this is the only way in — and it always writes the
   * caller's own id as the owner.
   */
  createApiToken: async ({ userId, params, tools }) => {
    const name = typeof params.name === 'string' ? params.name.trim().slice(0, 60) : ''
    if (!name) return { success: false, error: 'Give the token a name, like "Claude Code on laptop".' }

    const existing = await tools.query('api_tokens', { where: { ownerId: userId }, limit: MAX_TOKENS + 1 })
    if (!existing.success) return existing
    if (existing.data.records.length >= MAX_TOKENS) {
      return { success: false, error: `You can have up to ${MAX_TOKENS} tokens. Revoke one first.` }
    }

    const token = mintToken()
    const created = await tools.create('api_tokens', {
      name,
      tokenHash: await hashToken(token),
      prefix: token.slice(0, 10),
      ownerId: userId,
    } satisfies ApiToken)
    if (!created.success) return created
    return { success: true, data: { token, recordId: created.data.recordId } }
  },
}
