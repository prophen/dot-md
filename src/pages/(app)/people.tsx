/**
 * The directory — an `ls` of every published file. Public: signed-out
 * visitors and agents can browse it.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import type { Profile } from '../../schemas/profiles-schema'
import { age } from '../../lib/profile'

export default function PeoplePage() {
  const { records, status } = useQuery<Profile>('profiles', {
    where: { status: 'published' },
    orderBy: 'updatedAt',
    orderDir: 'desc',
  })
  const [filter, setFilter] = useState('')

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return records
    return records.filter(({ data }) =>
      [data.handle, data.name, data.tagline].some((v) => v?.toLowerCase().includes(q)),
    )
  }, [records, filter])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <title>~/people · dot-md</title>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
        <h1 className="text-[12px] tracking-wide text-muted-foreground">
          ~/people{status === 'ready' && <> · {records.length.toLocaleString()} {records.length === 1 ? 'file' : 'files'}</>}
        </h1>
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span aria-hidden>grep</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="name, handle, words"
            aria-label="Filter the directory"
            className="w-44 border-b border-input bg-transparent py-0.5 text-foreground outline-none placeholder:text-faint focus:border-mark"
          />
        </label>
      </div>

      {status === 'loading' ? (
        <p className="text-muted-foreground">reading directory…</p>
      ) : status === 'error' ? (
        <p className="text-destructive">Couldn't read the directory. Reload to try again.</p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground">
          {records.length === 0 ? (
            <>
              No files yet. <Link to="/edit" className="text-mark underline underline-offset-2">Write the first one.</Link>
            </>
          ) : (
            <>Nothing matches “{filter}”.</>
          )}
        </p>
      ) : (
        <ul>
          {shown.map(({ recordId, data, updatedAt }) => (
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
    </div>
  )
}
