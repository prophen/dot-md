/**
 * "Connect an agent": personal access tokens for the MCP endpoint. A token is
 * minted by the createApiToken action and shown once, with setup snippets for
 * common MCP clients; afterwards only its name and first characters remain.
 */

import { useState, type FormEvent } from 'react'
import { getAuthToken, useMutations, useQuery } from 'deepspace'
import { useToast } from '@/components/ui'
import type { ApiToken } from '../schemas/api-tokens-schema'
import { age } from '../lib/profile'

export function AgentAccess() {
  const { records, status } = useQuery<ApiToken>('api_tokens', { orderBy: 'createdAt', orderDir: 'desc' })
  const { ready, removeConfirmed } = useMutations<ApiToken>('api_tokens')
  const { error } = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)

  const endpoint = `${window.location.origin}/agent/mcp`

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/actions/createApiToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAuthToken()}` },
        body: JSON.stringify({ name: name.trim() }),
      })
      const body = (await res.json()) as { success: boolean; data?: { token: string }; error?: string }
      if (!body.success || !body.data) throw new Error(body.error ?? `Request failed (${res.status})`)
      setFresh(body.data.token)
      setName('')
    } catch (err) {
      error("Couldn't create a token", err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string, label: string) {
    if (!window.confirm(`Revoke "${label}"? Agents using it will lose access immediately.`)) return
    try {
      await removeConfirmed(id)
    } catch (err) {
      error("Couldn't revoke the token", String(err))
    }
  }

  return (
    <section className="mt-16 border-t border-border pt-8" aria-labelledby="agent-access">
      <h2 id="agent-access" className="font-serif text-2xl font-semibold">
        Connect an agent
      </h2>
      <p className="mt-2 max-w-prose font-serif text-[16px] text-muted-foreground">
        Let Claude, Cursor, Codex or any MCP client read and update your files. A token acts as you: it can
        create, edit, publish and unpublish your files, but never delete them.
      </p>

      <p className="mt-5 text-[12px] text-muted-foreground">
        MCP endpoint <code className="ml-1 bg-muted px-1.5 py-0.5 text-foreground">{endpoint}</code>
      </p>

      {fresh && <NewToken token={fresh} endpoint={endpoint} onDone={() => setFresh(null)} />}

      <form onSubmit={create} className="mt-6 flex max-w-xl flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1">
          <span className="mb-1 block text-[11px] text-muted-foreground">token name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Claude Code on laptop"
            className="w-full border border-input bg-card px-2.5 py-1.5 outline-none placeholder:text-faint focus:border-mark"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="border border-foreground px-3 py-1.5 hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'creating…' : 'create token'}
        </button>
      </form>

      {status === 'ready' && records.length > 0 && (
        <ul className="mt-6 max-w-xl" aria-label="Your tokens">
          {records.map(({ recordId, data, createdAt }) => (
            <li key={recordId} className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-dotted border-input py-2.5">
              <span className="min-w-0">
                {data.name}
                <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                  {data.prefix}… · created {age(createdAt)} ago
                  {data.lastUsedAt ? ` · used ${age(data.lastUsedAt)} ago` : ' · never used'}
                </span>
              </span>
              <button
                onClick={() => revoke(recordId, data.name)}
                disabled={!ready}
                className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-destructive"
              >
                revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NewToken({ token, endpoint, onDone }: { token: string; endpoint: string; onDone: () => void }) {
  const snippets = [
    {
      label: 'Claude Code',
      text: `claude mcp add --transport http dot-md ${endpoint} --header "Authorization: Bearer ${token}"`,
    },
    {
      label: 'Cursor / other clients (mcp.json)',
      text: JSON.stringify(
        { mcpServers: { 'dot-md': { url: endpoint, headers: { Authorization: `Bearer ${token}` } } } },
        null,
        2,
      ),
    },
  ]
  return (
    <div className="mt-6 max-w-2xl border border-mark bg-card p-4" role="status">
      <p className="text-[12.5px]">
        <span className="text-mark">Copy this token now.</span> It won't be shown again.
      </p>
      <Copyable text={token} label="token" testId="new-token" />
      {snippets.map((s) => (
        <div key={s.label} className="mt-4">
          <p className="mb-1 text-[11px] text-muted-foreground">{s.label}</p>
          <Copyable text={s.text} label={s.label} />
        </div>
      ))}
      <button onClick={onDone} className="mt-4 text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
        done
      </button>
    </div>
  )
}

function Copyable({ text, label, testId }: { text: string; label: string; testId?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-2 flex items-start gap-2">
      <pre data-testid={testId} className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all bg-muted px-2.5 py-2 text-[11.5px]">
        {text}
      </pre>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        aria-label={`Copy ${label}`}
        className="shrink-0 border border-input px-2 py-1 text-[11.5px] hover:border-foreground"
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  )
}
