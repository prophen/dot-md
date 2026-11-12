/**
 * The directory — an `ls` of every explicitly listed file. Public: signed-out
 * visitors and agents can browse it.
 */

import { useEffect, useState } from 'react'
import type { searchProfiles } from '../../server/profile-search'
import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import type { Profile } from '../../schemas/profiles-schema'
import { age } from '../../lib/profile'

export default function PeoplePage() {
  const [filter, setFilter] = useState('')
  const query = filter.trim()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <title>~/people · dot-md</title>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
        <h1 className="text-[12px] tracking-wide text-muted-foreground">
          ~/people
        </h1>
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span aria-hidden>grep</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="name, handle, words"
            aria-label="Search the directory"
            aria-describedby="directory-search-help"
            className="w-44 border-b border-input bg-transparent py-0.5 text-foreground outline-none placeholder:text-faint focus:border-mark"
          />
        </label>
      </div>

      <p id="directory-search-help" className="mb-6 text-[12px] text-muted-foreground">
        Search names, skills, and words anywhere in a listed profile. Use up to five keywords;
        every keyword must appear, and partial words count. Clear to browse.
      </p>
      {query ? <DirectorySearch key={query} query={query} /> : <DirectoryBrowse />}
    </div>
  )
}

function DirectoryBrowse() {
  const { records: rows, status } = useQuery<Profile>('profiles', {
    where: { status: 'published' },
    orderBy: 'updatedAt',
    orderDir: 'desc',
  })
  // Keep discovery listed-only even when a caller can read their own drafts.
  const records = rows.filter(({ data }) => data.status === 'published')
  return <>
    {status === 'ready' && <p role="status" className="mb-3 text-[12px] text-muted-foreground">{records.length.toLocaleString()} {records.length === 1 ? 'file' : 'files'}</p>}
    {status === 'loading' ? (
      <p role="status" className="text-muted-foreground">reading directory…</p>
    ) : status === 'error' ? (
      <p role="alert" className="text-destructive">Couldn't read the directory. Reload to try again.</p>
    ) : records.length === 0 ? (
      <p className="text-muted-foreground">
        No files yet. <Link to="/edit" className="text-mark underline underline-offset-2">Write the first one.</Link>
      </p>
    ) : (
      <ul>
        {records.map(({ recordId, data, updatedAt }) => (
          <li key={recordId} className="border-b border-dotted border-input">
            <Link
              to={`/p/${data.handle}`}
              className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 py-3"
            >
              <span className="min-w-0">
                <span className="group-hover:text-mark">{data.handle}.md</span>
                {data.kind === 'agent' && <span className="ml-2 text-[11px] text-muted-foreground">agent</span>}
                <span className="mt-0.5 block truncate font-serif text-[15px] text-muted-foreground">
                  {data.name}
                  {data.tagline && <> — {data.tagline}</>}
                </span>
              </span>
              <span className="text-[12px] text-muted-foreground">{age(updatedAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </>
}

type SearchResponse = Awaited<ReturnType<typeof searchProfiles>>

function DirectorySearch({ query }: { query: string }) {
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/public/search?${new URLSearchParams({ query, limit: '20' })}`, {
          signal: controller.signal, cache: 'no-store',
        })
        if (!response.ok) throw new Error(response.status === 400
          ? 'Use at most five keywords, 80 characters each and 200 characters total.'
          : "Couldn't search the directory. Try again.")
        const data = await response.json() as SearchResponse
        if (!controller.signal.aborted) setResult(data)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Couldn't search the directory. Try again.")
      }
    }, 250)
    // Keyed by query: old results disappear immediately, and even a response
    // arriving after cancellation cannot update this search or a newer one.
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, attempt])

  return <section aria-label="Search results" aria-busy={!result && !error}>
    <p role="status" className="mb-3 text-[12px] text-muted-foreground">
      {!result && !error ? 'Searching listed profiles…' : result
        ? `${result.results.length} ${result.results.length === 1 ? 'match' : 'matches'} for “${query}”, ordered by handle.` : ''}
    </p>
    {error && <div role="alert" className="text-destructive">
      <p>{error}</p>
      <button className="mt-2 underline underline-offset-2" onClick={() => { setError(''); setAttempt((value) => value + 1) }}>Try again</button>
    </div>}
    {result && <>
      <p aria-live="polite" className="mb-4 text-[12px] text-muted-foreground">
        Showing up to 20 matches.
        {result.hasMore && ' More matches exist. Narrow your keywords to see other matches.'}
        {result.scanTruncated && ' Scan limit reached: results may be incomplete. Try more specific keywords.'}
      </p>
      {result.results.length === 0 && <p className="text-muted-foreground">
        {result.scanTruncated ? 'No matches in the profiles scanned.' : 'No listed profiles match all your keywords.'}
      </p>}
      <ul>
        {result.results.map((profile) => <li key={profile.handle} className="border-b border-dotted border-input py-3">
          <Link to={`/p/${encodeURIComponent(profile.handle)}`} className="group block min-w-0">
            <span className="break-words group-hover:text-mark">{profile.handle}.md</span>
            {profile.kind === 'agent' && <span className="ml-2 text-[11px] text-muted-foreground">agent</span>}
            <span className="mt-0.5 block truncate font-serif text-[15px] text-muted-foreground">
              {profile.name}{profile.summary && <> — {profile.summary}</>}
            </span>
          </Link>
          <ul className="mt-2 space-y-2 text-[12px] text-muted-foreground">
            {profile.evidence.map((match) => <li key={match.keyword}>
              <span>{match.field === 'body' ? 'Markdown' : match.field} · “{match.keyword}”</span>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{match.excerpt}</p>
            </li>)}
          </ul>
        </li>)}
      </ul>
    </>}
  </section>
}
