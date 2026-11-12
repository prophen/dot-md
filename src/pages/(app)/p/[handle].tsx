/**
 * One profile, shown as its source. The same bytes are served raw at
 * /<handle>.md for agents.
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { SourceView } from '../../../components/SourceView'
import type { Profile } from '../../../schemas/profiles-schema'
import { age, rawPath } from '../../../lib/profile'

export default function ProfilePage() {
  const { handle = '' } = useParams()
  const { userId } = useAuth()
  const { records, status } = useQuery<Profile>('profiles', { where: { handle }, limit: 1 })
  const [publicResult, setPublicResult] = useState<{ handle: string; record?: { data: Profile; updatedAt?: string }; error?: boolean } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/public/profiles/${encodeURIComponent(handle)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 404) return undefined
        if (!res.ok) throw new Error('Could not load profile')
        return await res.json() as { data: Profile; updatedAt?: string }
      })
      .then((record) => setPublicResult({ handle, record }))
      .catch(() => { if (!controller.signal.aborted) setPublicResult({ handle, error: true }) })
    return () => controller.abort()
  }, [handle])
  const ownRecord = records.find((r) => r.data.handle === handle && r.createdBy === userId)
  const record = ownRecord ?? (publicResult?.handle === handle ? publicResult.record : undefined)
  const [copied, setCopied] = useState(false)

  if (!record && (publicResult?.handle !== handle || (userId && status === 'loading'))) {
    return <p className="mx-auto max-w-5xl px-4 py-14 text-muted-foreground sm:px-6">opening {handle}.md…</p>
  }

  if (!record && publicResult?.error) {
    return <p className="mx-auto max-w-5xl px-4 py-14 text-destructive">Couldn't open this file. Reload to try again.</p>
  }

  if (!record) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <title>Not found · dot-md</title>
        <p className="text-muted-foreground">cat: {handle}.md: No such file</p>
        <Link to="/people" className="mt-4 inline-block text-mark underline underline-offset-2">
          Back to ~/people
        </Link>
      </div>
    )
  }

  const { data, updatedAt } = record
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const curl = `curl ${origin}${rawPath(data.handle)}`
  const modified = updatedAt ? age(updatedAt) : null

  async function copy() {
    await navigator.clipboard.writeText(curl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_16rem]">
      <title>{`${data.name} · dot-md`}</title>
      {data.status !== 'published' && <meta name="robots" content="noindex" />}
      <meta name="description" content={data.tagline || `${data.name}'s person.md`} />
      <link rel="alternate" type="text/markdown" href={rawPath(data.handle)} />

      <article className="min-w-0">
        <p className="mb-5 text-[11px] text-muted-foreground">
          <Link to="/people" className="hover:text-foreground">~/people</Link> / {data.handle} / {data.kind === 'agent' ? 'agent.md' : 'person.md'}
          {data.status === 'draft' && <span className="ml-2 text-mark">draft — only you can see this</span>}
        </p>
        <SourceView body={data.body} />
      </article>

      <aside className="space-y-6 border-t border-border pt-6 text-[12px] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <div>
          <h2 className="mb-2 text-[11px] text-muted-foreground">for agents</h2>
          <button
            onClick={copy}
            className="w-full border border-foreground px-2.5 py-1.5 text-left text-[11.5px] break-all hover:bg-foreground hover:text-background"
          >
            {copied ? 'copied' : curl}
          </button>
          <a href={rawPath(data.handle)} className="mt-2 inline-block text-muted-foreground underline underline-offset-2 hover:text-foreground">
            open raw
          </a>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">kind</dt>
          <dd>{data.kind}</dd>
          <dt className="text-muted-foreground">modified</dt>
          <dd>{modified === null ? 'unknown' : modified === 'now' ? 'just now' : `${modified} ago`}</dd>
          <dt className="text-muted-foreground">lines</dt>
          <dd>{data.body.trimEnd().split('\n').length}</dd>
        </dl>
        {ownRecord && (
          <Link to={`/edit/${ownRecord.recordId}`} className="inline-block text-mark underline underline-offset-2">
            edit this file
          </Link>
        )}
      </aside>
    </div>
  )
}
