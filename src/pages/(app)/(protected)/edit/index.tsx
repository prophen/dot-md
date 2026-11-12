/**
 * Your files, and `touch` for a new one. A handle is permanent — it's the URL
 * people and agents will cite — so it's chosen here, once.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useMutations, useQuery } from 'deepspace'
import { useToast } from '@/components/ui'
import { HANDLE_RE, type Profile } from '../../../../schemas/profiles-schema'
import { age, localDate, rawPath } from '../../../../lib/profile'
import { STARTERS, getStarter, type StarterId } from '../../../../lib/starters'

export default function EditIndexPage() {
  const { userId } = useAuth()
  const { records, status } = useQuery<Profile>('profiles', { orderBy: 'updatedAt', orderDir: 'desc' })
  const mine = records.filter((r) => r.createdBy === userId)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <title>Your files · dot-md</title>
      <h1 className="mb-6 border-b border-border pb-3 text-[12px] tracking-wide text-muted-foreground">
        your files{status === 'ready' && <> · {mine.length}</>}
      </h1>

      {status === 'ready' && mine.length > 0 && (
        <ul className="mb-12">
          {mine.map(({ recordId, data, updatedAt }) => (
            <li key={recordId} className="border-b border-dotted border-input">
              <Link to={`/edit/${recordId}`} className="group grid grid-cols-[1fr_auto] items-baseline gap-4 py-3">
                <span className="group-hover:text-mark">
                  {data.handle}.md
                  {data.status === 'draft' && <span className="ml-2 text-[11px] text-mark">draft</span>}
                </span>
                <span className="text-[12px] text-muted-foreground">{age(updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewFile first={status === 'ready' && mine.length === 0} />
    </div>
  )
}

function NewFile({ first }: { first: boolean }) {
  const navigate = useNavigate()
  const { error } = useToast()
  const { ready, createConfirmed } = useMutations<Profile>('profiles')
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [starterId, setStarterId] = useState<StarterId>('developer-advocate')
  const [busy, setBusy] = useState(false)

  const handleOk = HANDLE_RE.test(handle)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!handleOk || !name.trim()) return
    setBusy(true)
    try {
      const starter = getStarter(starterId)
      const body = starter.sections({
        name: name.trim(),
        url: `${window.location.origin}${rawPath(handle)}`,
        date: localDate(),
      })
      const id = await createConfirmed({
        handle,
        name: name.trim(),
        tagline: '',
        kind: starter.kind,
        body,
        status: 'draft',
      })
      navigate(`/edit/${id}`)
    } catch (err) {
      const msg = String(err)
      error(
        msg.includes('Duplicate') ? `${handle}.md is taken` : "Couldn't create the file",
        msg.includes('Duplicate') ? 'Handles are first come, first served. Try another.' : msg,
      )
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h2 className="font-serif text-2xl font-semibold">
        {first ? 'Write your person.md' : 'New file'}
      </h2>
      {first && (
        <p className="max-w-prose font-serif text-[16px] text-muted-foreground">
          A plain markdown file about you, at a URL any agent can fetch. Pick a starter and a handle; the
          file stays a draft until you publish it.
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-[11px] text-muted-foreground">starter</legend>
        <div className="grid max-w-2xl border-t border-dotted border-input sm:grid-cols-2 sm:gap-x-6">
          {STARTERS.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-start gap-2.5 border-b border-dotted border-input py-2.5 has-[:checked]:text-mark"
            >
              <input
                type="radio"
                name="starter"
                value={s.id}
                checked={starterId === s.id}
                onChange={() => setStarterId(s.id)}
                className="mt-1 accent-mark"
              />
              <span>
                {s.label}
                <span className="block font-serif text-[14.5px] text-muted-foreground">{s.blurb}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 max-w-2xl text-[11.5px] text-muted-foreground">
          Modeled on <a href="https://lauren.md" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">lauren.md</a>: a summary, rules for the agent reading it, then sections it can quote. Replace anything in [brackets].
        </p>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-[11px] text-muted-foreground">name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          className="w-full max-w-sm border border-input bg-card px-2.5 py-1.5 font-serif text-[16px] outline-none focus:border-mark"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] text-muted-foreground">handle — permanent</span>
        <span className="flex max-w-sm items-center border border-input bg-card focus-within:border-mark">
          <span className="pl-2.5 text-muted-foreground">{window.location.host}/</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            maxLength={40}
            required
            aria-invalid={handle.length > 0 && !handleOk}
            className="min-w-0 flex-1 bg-transparent py-1.5 outline-none"
          />
          <span className="pr-2.5 text-muted-foreground">.md</span>
        </span>
        {handle.length > 0 && !handleOk && (
          <span className="mt-1 block text-[11.5px] text-destructive">
            Letters, numbers and hyphens; can't start or end with a hyphen.
          </span>
        )}
      </label>

      <button
        type="submit"
        disabled={!ready || busy || !handleOk || !name.trim()}
        className="border border-foreground bg-foreground px-3 py-1.5 text-background hover:bg-transparent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'creating…' : `touch ${handle || 'handle'}.md`}
      </button>
    </form>
  )
}
