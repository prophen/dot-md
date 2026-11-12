/**
 * Personal access tokens for the MCP endpoint (/agent/mcp).
 *
 * Only a SHA-256 hash of each token is stored; the token itself is shown once,
 * when the createApiToken action mints it. Members can list and revoke their
 * own tokens but never create or edit rows directly — minting happens in the
 * action so the secret is generated server-side.
 */

import type { CollectionSchema } from 'deepspace/schema'

export type ApiToken = {
  name: string
  tokenHash: string
  /** First characters of the token, so people can tell tokens apart. */
  prefix: string
  ownerId: string
  lastUsedAt?: string
}

export const apiTokensSchema: CollectionSchema = {
  name: 'api_tokens',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 60 },
    { name: 'tokenHash', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'prefix', storage: 'text', interpretation: 'plain', immutable: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, immutable: true, userBound: true },
    { name: 'lastUsedAt', storage: 'text', interpretation: 'plain' },
  ],
  uniqueOn: ['tokenHash'],
  ownerField: 'ownerId',
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: 'own' },
    admin: { read: 'own', create: false, update: false, delete: 'own' },
  },
}
