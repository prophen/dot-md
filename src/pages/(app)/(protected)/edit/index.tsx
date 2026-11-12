/**
 * Your files, and `touch` for a new one. A handle is permanent — it's the URL
 * people and agents will cite — so it's chosen here, once.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useMutations, useQuery } from 'deepspace'
import { useToast } from '@/components/ui'
import { SourceView } from '../../../../components/SourceView'
import { PASTE_LIMIT, preparePastedDraft } from '../../../../lib/paste-draft'
import { AgentAccess } from '../../../../components/AgentAccess'
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
                  <span className="ml-2 text-[11px] text-muted-foreground">{data.status === 'draft' ? 'draft' : data.status === 'published' ? 'published · listed' : 'published · unlisted'}</span>
                </span>
                <span className="text-[12px] text-muted-foreground">{age(updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewFile first={status === 'ready' && mine.length === 0} />
      <AgentAccess />
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
  const [mode, setMode] = useState<'paste' | 'starter'>('paste')
  const [source, setSource] = useState('')
  const [draft, setDraft] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  function prepare() {
    try {
      setDraft(preparePastedDraft(source))
      setMessage('')
    } catch (err) {
      setMessage((err as Error).message)
    }
  }

  const handleOk = HANDLE_RE.test(handle)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !ready || !handleOk || !name.trim() || (mode === 'paste' && draft === null)) return
    if (mode === 'paste') {
      try { preparePastedDraft(draft ?? '') } catch (err) {
        setMessage((err as Error).message)
        return
      }
    }
    setBusy(true)
    try {
      const starter = getStarter(starterId)
      setMessage('')
      const body = mode === 'paste' ? preparePastedDraft(draft ?? '') : starter.sections({
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
      setMessage(msg.includes('Duplicate') ? `${handle}.md is taken. Try another handle; your draft is still here.` : "Couldn't save the draft. Your text is still here. Check your connection and try again.")
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
          A plain markdown file about you, at a URL any agent can fetch. Paste what you already have, or pick a starter. Review your file before saving; it
          stays a draft until you publish it.
        </p>
      )}

      <div className="flex gap-4 text-[12px]" aria-label="Starting point">
        <button type="button" aria-pressed={mode === 'paste'} disabled={busy} onClick={() => { setMode('paste'); setMessage('') }} className="underline underline-offset-4 aria-pressed:text-mark">Paste existing text</button>
        <button type="button" aria-pressed={mode === 'starter'} disabled={busy} onClick={() => { setMode('starter'); setMessage('') }} className="underline underline-offset-4 aria-pressed:text-mark">Use a starter</button>
      </div>

      {mode === 'paste' && (
        <section className="space-y-3" aria-label="Paste to draft">
          <p className="text-[12px] text-muted-foreground">
            Resume text, a bio, or existing Markdown · up to 20,000 characters.
            Text only: no files, scraping, or rich-text layout conversion. HTML and unsupported Markdown remain literal text.
          </p>
          {draft === null ? <>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">Paste your text</span>
              <textarea value={source} onChange={(e) => { setSource(e.target.value); setMessage('') }} rows={12}
                aria-describedby="paste-count" disabled={busy}
                className="w-full resize-y border border-input bg-card p-4 font-mono text-[13px] leading-[1.75] outline-none focus:border-mark" />
            </label>
            <p id="paste-count" className="text-[11px] text-muted-foreground">{source.length.toLocaleString()} / 20,000 chars · Nothing is saved yet.</p>
            <button type="button" onClick={prepare} className="border border-foreground px-3 py-1.5 hover:text-mark">Prepare draft</button>
          </> : <>
            <p className="text-[12px] text-muted-foreground">
              Review your draft. We copied your text, normalizing line endings only. No AI rewriting or fact extraction.
              Name and handle are entered by you, never extracted from the text. Add any missing role, dates, links, or contact details yourself; nothing is guessed.
              Nothing is saved until you choose save draft. Leaving this page discards unsaved text.
            </p>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">Draft Markdown</span>
              <textarea value={draft} onChange={(e) => { setDraft(e.target.value); setMessage('') }} rows={16} disabled={busy}
                className="w-full resize-y border border-input bg-card p-4 font-mono text-[13px] leading-[1.75] outline-none focus:border-mark" />
            </label>
            <p className="text-[11px] text-muted-foreground">{draft.length.toLocaleString()} / {PASTE_LIMIT.toLocaleString()} chars · Check facts and remove anything you don't want to share.</p>
            <details className="border-y border-dotted border-input py-3">
              <summary className="cursor-pointer text-[12px] text-muted-foreground">preview</summary>
              <SourceView body={draft} className="mt-4" />
            </details>
            <button type="button" disabled={busy} onClick={() => { setSource(draft); setDraft(null); setMessage('') }} className="text-[12px] underline underline-offset-2">Back to pasted text</button>
          </>}
        </section>
      )}
      {message && <p role="alert" className="text-[12px] text-destructive">{message}</p>}

      {mode === 'starter' && <fieldset disabled={busy}>
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
      </fieldset>}

      <label className="block">
        <span className="mb-1 block text-[11px] text-muted-foreground">name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
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
            disabled={busy}
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
        disabled={!ready || busy || !handleOk || !name.trim() || (mode === 'paste' && draft === null)}
        className="border border-foreground bg-foreground px-3 py-1.5 text-background hover:bg-transparent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'creating…' : mode === 'paste' ? 'save draft' : `touch ${handle || 'handle'}.md`}
      </button>
    </form>
  )
}
