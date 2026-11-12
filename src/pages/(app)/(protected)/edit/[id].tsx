/**
 * The editor: raw markdown on the left, the rendered source view on the
 * right. Saves are explicit so a half-typed line never goes public.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth, useMutations, useQuery } from 'deepspace'
import { useToast } from '@/components/ui'
import { SourceView } from '../../../../components/SourceView'
import type { Profile } from '../../../../schemas/profiles-schema'
import { touchLastUpdated } from '../../../../lib/profile'

/** Name from the first `# ` line; tagline from the first `> ` summary or
 *  paragraph after it, skipping unfilled [bracket] prompts. */
function summarize(body: string): { name?: string; tagline: string } {
  const lines = body.split('\n')
  const h1 = lines.findIndex((l) => /^# \S/.test(l))
  const name = h1 >= 0 ? lines[h1].slice(2).trim() : undefined
  const rest = lines.slice(h1 + 1)
  const start = rest.findIndex((l) => l.trim() && !/^(#|[-*|] |\||<!--)/.test(l))
  const block: string[] = []
  for (const l of start >= 0 ? rest.slice(start) : []) {
    if (!l.trim()) break
    block.push(l.replace(/^> ?/, '').trim())
  }
  const text = block.join(' ')
  return { name, tagline: text.startsWith('[') ? '' : text.slice(0, 200) }
}

export default function EditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const { success, error } = useToast()
  const { records, status } = useQuery<Profile>('profiles')
  const { ready, putConfirmed, removeConfirmed } = useMutations<Profile>('profiles')
  const record = records.find((r) => r.recordId === id)

  const [body, setBody] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (record && body === null) setBody(record.data.body)
  }, [record, body])

  if (status === 'loading' || (record && body === null)) {
    return <p className="mx-auto max-w-6xl px-4 py-14 text-muted-foreground sm:px-6">opening…</p>
  }
  if (!record || record.createdBy !== userId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <p className="text-muted-foreground">That file doesn't exist, or it isn't yours.</p>
        <Link to="/edit" className="mt-4 inline-block text-mark underline underline-offset-2">Your files</Link>
      </div>
    )
  }

  const { data } = record
  const text = body ?? ''
  const dirty = text !== data.body

  async function save(nextStatus = data.status) {
    const next = touchLastUpdated(text)
    const { name, tagline } = summarize(next)
    setSaving(true)
    try {
      await putConfirmed(id, { body: next, name: name || data.name, tagline, status: nextStatus })
      setBody(next)
      success(nextStatus === 'published' && data.status !== 'published' ? 'Published' : 'Saved')
    } catch (err) {
      error("Couldn't save", String(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${data.handle}.md? Its URL will stop working.`)) return
    try {
      await removeConfirmed(id)
      navigate('/edit')
    } catch (err) {
      error("Couldn't delete", String(err))
    }
  }

  const lineCount = text.split('\n').length

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <title>{`${data.handle}.md · edit · dot-md`}</title>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-[12px]">
        <Link to="/edit" className="text-muted-foreground hover:text-foreground">~/you</Link>
        <span>
          {data.handle}.md{dirty && <span className="text-mark"> ●</span>}
        </span>
        <span className={data.status === 'published' ? 'text-muted-foreground' : 'text-mark'}>{data.status}</span>
        <span className="flex-1" />
        {data.status === 'published' && (
          <Link to={`/p/${data.handle}`} className="text-muted-foreground underline underline-offset-2 hover:text-foreground">view</Link>
        )}
        <button
          onClick={() => save()}
          disabled={!ready || saving || !dirty}
          className="border border-foreground px-2.5 py-1 hover:bg-foreground hover:text-background disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-foreground"
        >
          save
        </button>
        <button
          onClick={() => save(data.status === 'published' ? 'draft' : 'published')}
          disabled={!ready || saving}
          className="border border-foreground bg-foreground px-2.5 py-1 text-background hover:bg-transparent hover:text-foreground disabled:opacity-40"
        >
          {data.status === 'published' ? 'unpublish' : 'publish'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <label className="block">
          <span className="sr-only">Markdown</span>
          <textarea
            value={text}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                if (dirty && !saving) void save()
              }
            }}
            spellCheck
            maxLength={20000}
            rows={Math.max(24, lineCount + 2)}
            className="w-full resize-y border border-input bg-card p-4 font-mono text-[13px] leading-[1.75] outline-none focus:border-mark"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {lineCount} lines · {text.length.toLocaleString()} / 20,000 chars · ⌘S saves
          </span>
        </label>
        <div className="min-w-0 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-4">
          <p className="mb-4 text-[11px] text-muted-foreground">preview</p>
          <SourceView body={text} />
        </div>
      </div>

      <button onClick={remove} className="mt-10 text-[12px] text-muted-foreground underline underline-offset-2 hover:text-destructive">
        delete this file
      </button>
    </div>
  )
}
