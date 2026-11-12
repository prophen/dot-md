import { z } from 'zod/v4'
import type { Profile } from '../schemas/profiles-schema'
import type { Env } from '../../worker'

export const searchInput = z.object({
  query: z.string().trim().min(1).max(200).refine(
    (value) => value.split(/\s+/u).length <= 5,
    'Use at most five whitespace-separated keywords.',
  ).refine((value) => value.split(/\s+/u).every((term) => term.length <= 80), 'Each keyword must be at most 80 characters.'),
  limit: z.number().int().min(1).max(20).default(10),
}).strict()

export const SEARCH_DESCRIPTION = 'Search explicitly listed profiles by case-insensitive literal keywords in handle, name, tagline and Markdown. All whitespace-separated keywords must match (at most five, 200 characters total, 80 per keyword). Returns bounded source excerpts and public URLs, ordered by handle, not relevance or quality. No semantic matching. Drafts and unlisted files are excluded even for their owner. Scans at most 1,000 listed records / 20 database pages; scanTruncated means results may be incomplete.'

type Field = 'handle' | 'name' | 'tagline' | 'body'
const fields: Field[] = ['handle', 'name', 'tagline', 'body']

function evidence(profile: Profile, terms: string[]) {
  // One source slice per keyword, preserving the original text. Never return
  // the full file or internal metadata as part of discovery.
  return terms.map((term) => {
    const field = fields.find((key) => profile[key].toLowerCase().includes(term))!
    const source = profile[field]
    const foldedIndex = source.toLowerCase().indexOf(term)
    // Lowercasing can expand a character (e.g. İ). Translate the matched
    // offset back to source coordinates so the slice still contains evidence.
    let index = 0
    let foldedOffset = 0
    for (const character of source) {
      if (foldedOffset >= foldedIndex) break
      foldedOffset += character.toLowerCase().length
      index += character.length
    }
    const start = Math.max(0, index - 60)
    return { keyword: term, field, excerpt: source.slice(start, start + 160) }
  })
}

export async function searchProfiles(env: Env, origin: string, input: unknown) {
  const { query, limit } = searchInput.parse(input)
  const terms = [...new Set(query.toLowerCase().split(/\s+/u))]
  const results = []
  let offset = 0
  let scanned = 0
  let scanTruncated = false
  let hasMore = false
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  for (let page = 0; page < 20; page++) {
    const response = await stub.fetch(new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': env.OWNER_USER_ID, 'X-App-Action': 'true' },
      body: JSON.stringify({ tool: 'records.query', params: {
        collection: 'profiles', where: { status: 'published' },
        orderBy: 'handle', orderDir: 'asc', offset, limit: Math.min(100, 1000 - scanned),
      } }),
    }))
    const result = await response.json() as {
      success: boolean
      data?: { records: Array<{ data: Profile }>; nextOffset?: number }
    }
    if (!response.ok || !result.success || !result.data) throw new Error('Profile search unavailable')
    for (const { data } of result.data.records) {
      scanned++
      // This check is independent of caller RBAC, including administrator and
      // owner access. Only the stored listed state is eligible for discovery.
      if (data.status !== 'published' || !terms.every((term) => fields.some((field) => data[field].toLowerCase().includes(term)))) continue
      if (results.length === limit) { hasMore = true; break }
      const handle = encodeURIComponent(data.handle)
      results.push({ handle: data.handle, name: data.name, summary: data.tagline,
        kind: data.kind, status: 'published' as const, listed: true,
        page: `${origin}/p/${handle}`, raw: `${origin}/${handle}.md`, evidence: evidence(data, terms) })
    }
    if (hasMore || result.data.nextOffset === undefined) break
    if (result.data.nextOffset <= offset) throw new Error('Profile search pagination failed')
    offset = result.data.nextOffset
    if (scanned >= 1000 || page === 19) { scanTruncated = true; break }
  }
  return { query, matching: 'all literal keywords, case-insensitive', results, hasMore, scanTruncated }
}
