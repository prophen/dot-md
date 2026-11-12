/**
 * Tools for reading and writing your own person.md, served over MCP at
 * /agent/mcp (personal access tokens) and the DeepSpace agent route.
 *
 * Every record call goes through `executor`, which runs as the verified
 * caller with normal RBAC: an agent can only touch files its person owns.
 * The tools add the rules the editor applies — handle format, starters,
 * the directory summary, and the *Last updated* stamp — so a file written
 * by an agent looks the same as one written by hand. There is deliberately
 * no delete tool; deleting stays a human action in the editor.
 */

import { tool, type ToolSet } from 'ai'
import { z } from 'zod/v4'
import { AgentToolError } from 'deepspace/worker'
import { HANDLE_RE, type Profile } from '../schemas/profiles-schema'
import { localDate, rawPath, summarize, touchLastUpdated } from '../lib/profile'
import { OPEN_TO, readOpportunities, writeOpportunities } from '../lib/opportunities'
import { STARTERS, getStarter, type StarterId } from '../lib/starters'

type Executor = (toolName: string, params: Record<string, unknown>) => Promise<unknown>

interface ToolResult<T> {
  success: boolean
  data?: T
  error?: string
}

interface Envelope {
  recordId: string
  data: Profile
  createdBy: string
  updatedAt?: string
}

const STARTER_IDS = STARTERS.map((s) => s.id) as [StarterId, ...StarterId[]]

const handleSchema = z
  .string()
  .regex(HANDLE_RE, 'Lowercase letters, numbers and hyphens; 1–40 characters; no leading or trailing hyphen.')
  .describe('The file handle, e.g. "ada" for ada.md.')

async function call<T>(executor: Executor, toolName: string, params: Record<string, unknown>): Promise<T> {
  const result = (await executor(toolName, params)) as ToolResult<T>
  if (!result.success) {
    const message = result.error ?? 'The request was refused.'
    if (/duplicate/i.test(message)) throw new AgentToolError('handle_taken', 'That handle is taken. Choose another.', 409)
    if (/permission|denied|not allowed/i.test(message)) throw new AgentToolError('forbidden', message, 403)
    throw new AgentToolError('record_error', message, 400)
  }
  return result.data as T
}

export interface ProfileToolContext {
  userId: string
  /** Public origin, for URLs in results and the starter's canonical link. */
  origin: string
}

export function buildProfileTools(executor: Executor, { userId, origin }: ProfileToolContext): ToolSet {
  const describe = (r: Envelope) => ({
    handle: r.data.handle,
    name: r.data.name,
    summary: r.data.tagline,
    status: r.data.status === 'draft' ? 'draft' : 'published',
    listed: r.data.status === 'published',
    updatedAt: r.updatedAt,
    page: `${origin}/p/${r.data.handle}`,
    raw: `${origin}${rawPath(r.data.handle)}`,
  })

  async function mine(): Promise<Envelope[]> {
    const { records } = await call<{ records: Envelope[] }>(executor, 'records.query', {
      collection: 'profiles',
      where: { createdBy: userId },
      orderBy: 'updatedAt',
      orderDir: 'desc',
      limit: 100,
    })
    return records
  }

  async function ownFile(handle: string): Promise<Envelope> {
    const { records } = await call<{ records: Envelope[] }>(executor, 'records.query', {
      collection: 'profiles',
      where: { handle },
      limit: 1,
    })
    const record = records[0]
    if (!record || record.createdBy !== userId) {
      throw new AgentToolError('not_found', `You don't have a file called ${handle}.md.`, 404)
    }
    return record
  }

  async function setStatus(handle: string, status: 'draft' | 'published', listed?: boolean) {
    const record = await ownFile(handle)
    const nextStatus: Profile['status'] = status === 'draft' ? 'draft'
      : (listed ?? record.data.status === 'published') ? 'published' : 'unlisted'
    await call(executor, 'records.update', { collection: 'profiles', recordId: record.recordId, data: { status: nextStatus } })
    return describe({ ...record, data: { ...record.data, status: nextStatus } })
  }

  return {
    list_starters: tool({
      description:
        'List the starter templates for a new file. Each is a person.md outline with [bracketed] prompts to replace.',
      inputSchema: z.object({}),
      execute: async () => ({ starters: STARTERS.map(({ id, label, blurb }) => ({ id, label, blurb })) }),
    }),

    list_my_files: tool({
      description: "List the signed-in person's files, drafts included, newest first.",
      inputSchema: z.object({}),
      execute: async () => ({ files: (await mine()).map(describe) }),
    }),

    read_file: tool({
      description: 'Read one of your files, including its full markdown.',
      inputSchema: z.object({ handle: handleSchema }),
      execute: async ({ handle }) => {
        const record = await ownFile(handle)
        return { ...describe(record), markdown: record.data.body, opportunities: readOpportunities(record.data.body) }
      },
    }),

    create_file: tool({
      description:
        'Create a new file as a draft. Starts from a starter template unless you pass markdown. The handle is permanent: it becomes the URL.',
      inputSchema: z.object({
        handle: handleSchema,
        name: z.string().min(1).max(120).describe("The person's name, used as the file's # heading."),
        starter: z.enum(STARTER_IDS).optional().describe('Starter id from list_starters. Defaults to "blank".'),
        markdown: z.string().max(20000).optional().describe('Full file contents. Overrides the starter.'),
      }),
      execute: async ({ handle, name, starter, markdown }) => {
        const body =
          markdown ??
          getStarter(starter ?? 'blank').sections({ name, url: `${origin}${rawPath(handle)}`, date: localDate() })
        const summary = summarize(body)
        const { recordId } = await call<{ recordId: string }>(executor, 'records.create', {
          collection: 'profiles',
          data: {
            handle,
            name: summary.name || name,
            tagline: summary.tagline,
            kind: 'person',
            body,
            status: 'draft',
          } satisfies Profile,
        })
        return {
          recordId,
          handle,
          status: 'draft',
          editor: `${origin}/edit/${recordId}`,
          next: 'Replace the [bracketed] prompts with update_file, then publish_file when the person is happy with it.',
        }
      },
    }),

    update_file: tool({
      description:
        "Replace a file's markdown. Bumps its 'Last updated' date and refreshes the name and summary shown in the directory. Read the file first and send the whole new contents.",
      inputSchema: z.object({
        handle: handleSchema,
        markdown: z.string().min(1).max(20000).describe('The complete new file contents.'),
      }),
      execute: async ({ handle, markdown }) => {
        const record = await ownFile(handle)
        const body = touchLastUpdated(markdown)
        const { name, tagline } = summarize(body)
        await call(executor, 'records.update', {
          collection: 'profiles',
          recordId: record.recordId,
          data: { body, name: name || record.data.name, tagline },
        })
        return { ...describe({ ...record, data: { ...record.data, body, tagline } }), saved: true }
      },
    }),

    update_opportunities: tool({
      description: 'Replace optional opportunity preferences in your Markdown. Only set preferences the person explicitly chose; never infer them. Read the file first. All three fields are required: empty openTo and empty strings clear the section. Preserves other Markdown and publication/listing state. Refuses ambiguous or custom marked sections; use update_file to edit those directly.',
      inputSchema: z.object({
        handle: handleSchema,
        openTo: z.array(z.enum(OPEN_TO)),
        availability: z.string().regex(/^[^\r\n]*$/).describe('Optional single line; empty string clears it.'),
        workPreferences: z.string().regex(/^[^\r\n]*$/).describe('Optional single line; empty string clears it.'),
      }),
      execute: async ({ handle, ...preferences }) => {
        const record = await ownFile(handle)
        let body: string
        try { body = touchLastUpdated(writeOpportunities(record.data.body, preferences)) }
        catch (error) { throw new AgentToolError('invalid_opportunities', (error as Error).message, 400) }
        const { name, tagline } = summarize(body)
        await call(executor, 'records.update', {
          collection: 'profiles', recordId: record.recordId,
          data: { body, name: name || record.data.name, tagline },
        })
        return { ...describe({ ...record, data: { ...record.data, body, name: name || record.data.name, tagline } }), saved: true, opportunities: readOpportunities(body) }
      },
    }),

    publish_file: tool({
      description: 'Publish a file at its public URLs. New publications are unlisted by default. Set listed to true only if the person wants directory inclusion, or false to remove a listing. Omitting listed preserves an existing publication’s listing choice. Confirm with the person first.',
      inputSchema: z.object({ handle: handleSchema, listed: z.boolean().optional().describe('Opt in to the public directory. Unlisted files remain accessible to anyone with the URL.') }),
      execute: async ({ handle, listed }) => setStatus(handle, 'published', listed),
    }),

    unpublish_file: tool({
      description: 'Return a file to draft. It disappears from the directory and its public URLs.',
      inputSchema: z.object({ handle: handleSchema }),
      execute: async ({ handle }) => setStatus(handle, 'draft'),
    }),
  }
}
