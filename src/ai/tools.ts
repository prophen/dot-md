/**
 * AI Tool Definitions — the one tool set every agent surface gets: the
 * DeepSpace agent route, and dot-md's own MCP endpoint (/agent/mcp).
 *
 * These are the profile tools in ./profile-tools, not DeepSpace's generic
 * record tools: an agent edits a person.md through the same rules as the
 * editor (handles, starters, summary, Last updated) rather than writing rows.
 * Per-collection RBAC at the DO layer is still the security boundary — every
 * call runs as the verified caller.
 */

import type { ToolSet } from 'ai'
import type { AgentToolContext, CollectionSchema } from 'deepspace/worker'
import { buildProfileTools } from './profile-tools'

type ToolExecutor = (toolName: string, params: Record<string, unknown>) => Promise<unknown>

// ============================================================================
// System prompt
// ============================================================================

type Interpretation = CollectionSchema['columns'][number]['interpretation']

/**
 * Interpretation is `string | Record<string, unknown>`. When it's an object
 * the convention across the SDK's schemas is `{ kind: string, ... }`.
 * Narrow safely to a human-readable name.
 */
function interpretationLabel(interpretation: Interpretation): string {
  if (typeof interpretation === 'string') return interpretation
  const kind = interpretation.kind
  return typeof kind === 'string' ? kind : 'object'
}

export function buildSystemPrompt(appName: string, schemas: CollectionSchema[]): string {
  const schemaSummary = schemas
    .map((s) => {
      const cols = (s.columns ?? [])
        .map((c) => `${c.name}:${interpretationLabel(c.interpretation)}${c.required ? '!' : ''}`)
        .join(', ')
      return `- ${s.name}${cols ? ` (${cols})` : ''}`
    })
    .join('\n')

  return [
    `You are the assistant for the "${appName}" app on DeepSpace.`,
    "You can read and modify the user's data via the available tools. The",
    "user's own role and permissions still apply at the data layer — your",
    'tool calls run as the calling user, so you can only do what they could.',
    '',
    'Be careful with mutations:',
    '- Confirm intent before destructive actions (delete, bulk update).',
    '- Operate only on collections the user explicitly mentioned.',
    '- After a successful write, briefly confirm what changed.',
    '- If a write is denied (RBAC), tell the user plainly — do not retry blindly.',
    '',
    'Use tools to look up facts before answering. Do not invent data.',
    'If data is missing, say so plainly. Keep answers concise.',
    '',
    'Available collections:',
    schemaSummary || '(none)',
  ].join('\n')
}

// ============================================================================
// Tool definitions
// ============================================================================

export function buildTools(executor: ToolExecutor, context: AgentToolContext): ToolSet {
  return buildProfileTools(executor, {
    userId: context.userId,
    origin: new URL(context.request.url).origin,
  })
}
