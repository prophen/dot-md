/**
 * Profiles — one person.md (or agent.md) file each.
 *
 * `body` is the markdown file itself, served verbatim at /<handle>.md for
 * agents. `name` and `tagline` are copies for the directory listing so it
 * never has to parse markdown. Handles are permanent: they're the URL.
 */

import { PROFILE_STYLES, type ProfileStyle } from '../lib/profile-style'
import type { CollectionSchema } from 'deepspace/schema'

export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export type ProfileKind = 'person' | 'agent'
// `published` retains the original listed state; `unlisted` is public by URL only.
export type ProfileStatus = 'draft' | 'published' | 'unlisted'

export type Profile = {
  handle: string
  name: string
  tagline: string
  kind: ProfileKind
  body: string
  style?: ProfileStyle
  draftListed?: boolean
  status: ProfileStatus
}

export const profilesSchema: CollectionSchema = {
  name: 'profiles',
  columns: [
    { name: 'handle', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 40 },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 120 },
    { name: 'tagline', storage: 'text', interpretation: 'plain', maxLength: 200 },
    { name: 'kind', storage: 'text', interpretation: { kind: 'select', options: ['person', 'agent'] } },
    { name: 'style', storage: 'text', interpretation: { kind: 'select', options: [...PROFILE_STYLES] } },
    // Remember the directory choice while private; visibility still depends only on status.
    { name: 'draftListed', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'body', storage: 'text', interpretation: 'plain', maxLength: 20000 },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['draft', 'published', 'unlisted'] },
    },
  ],
  uniqueOn: ['handle'],
  visibilityField: { field: 'status', value: 'published' },
  permissions: {
    '*': { read: 'published', create: false, update: false, delete: false },
    viewer: { read: 'published', create: false, update: false, delete: false },
    member: { read: 'published', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
