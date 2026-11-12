/**
 * The editor: raw markdown on the left, the rendered source view on the
 * right. Saves are explicit so a half-typed line never goes public.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth, useMutations, useQuery } from 'deepspace'
import { useToast } from '@/components/ui'
import { OpportunityEditor } from '../../../../components/OpportunityEditor'
import { SourceView } from '../../../../components/SourceView'
import type { Profile } from '../../../../schemas/profiles-schema'
import { summarize, touchLastUpdated } from '../../../../lib/profile'

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
  const [listed, setListed] = useState<boolean | null>(null)
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
  const wantsListing = listed ?? data.status === 'published'
  const dirty = text !== data.body || (data.status !== 'draft' && wantsListing !== (data.status === 'published'))

  async function save(nextStatus = data.status) {
    if (nextStatus !== 'draft') nextStatus = wantsListing ? 'published' : 'unlisted'
    const next = touchLastUpdated(text)
    const { name, tagline } = summarize(next)
    setSaving(true)
    try {
      await putConfirmed(id, { body: next, name: name || data.name, tagline, status: nextStatus })
      setBody(next)
      setListed(nextStatus === 'draft' && data.status === 'draft' ? listed : null)
      success(nextStatus !== 'draft' && data.status === 'draft' ? 'Published' : 'Saved')
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
        <Link to="/edit" className="text-muted-foreground hover:text-foreground">your files</Link>
        <span>
          {data.handle}.md{dirty && <span className="text-mark"> ●</span>}
        </span>
        <span className={data.status !== 'draft' ? 'text-muted-foreground' : 'text-mark'}>{data.status === 'draft' ? 'draft' : data.status === 'published' ? 'published · listed' : 'published · unlisted'}</span>
        <span className="flex-1" />
        {data.status !== 'draft' && (
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
          onClick={() => save(data.status !== 'draft' ? 'draft' : 'published')}
          disabled={!ready || saving}
          className="border border-foreground bg-foreground px-2.5 py-1 text-background hover:bg-transparent hover:text-foreground disabled:opacity-40"
        >
          {data.status !== 'draft' ? 'unpublish' : 'publish'}
        </button>
      </div>

      <div className="mb-6 text-[12px]">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={wantsListing} onChange={(e) => setListed(e.target.checked)} disabled={saving} />
          List me in the directory
        </label>
        <p className="mt-2 text-muted-foreground">Publishing makes your file accessible to anyone with its URL. Directory listing is optional. Changes take effect when you save or publish.</p>
      </div>

      <OpportunityEditor body={text} onChange={setBody} onError={(message) => error("Couldn’t update opportunities", message)} disabled={saving} />

      <div className="grid gap-6 lg:grid-cols-2">
        <label className="block">
          <span className="sr-only">Markdown</span>
          <textarea
            aria-label="Markdown"
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
