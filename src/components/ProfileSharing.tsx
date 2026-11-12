import { useState } from 'react'
import type { Profile } from '../schemas/profiles-schema'
import { rawPath } from '../lib/profile'

const buttonClass = 'min-h-11 w-full border border-input px-3 py-2 text-left hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark disabled:opacity-50'

export function ProfileSharing({ profile }: { profile: Profile }) {
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const isPublic = profile.status === 'published' || profile.status === 'unlisted'
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const markdownUrl = `${origin}${rawPath(profile.handle)}`
  const curl = `curl ${markdownUrl}`

  async function copy(text: string, label: string) {
    setBusy(true)
    setFeedback('')
    try {
      await navigator.clipboard.writeText(text)
      setFeedback(`${label} copied.`)
    } catch {
      setFeedback(`Couldn't copy ${label.toLowerCase()}. Try again.`)
    } finally {
      setBusy(false)
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([profile.body], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${profile.handle}.md`
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Allow the browser to start reading the blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section aria-labelledby="profile-sharing-heading" className="space-y-3">
      <h2 id="profile-sharing-heading" className="text-[11px] text-muted-foreground">Share & download</h2>
      {!isPublic && <p className="text-muted-foreground">Publish to share a link.</p>}
      <div className="flex flex-col gap-2">
        {isPublic && <>
          <button type="button" className={buttonClass} disabled={busy} onClick={() => copy(`${origin}/p/${profile.handle}`, 'Profile link')}>Copy profile link</button>
          <button type="button" className={buttonClass} disabled={busy} onClick={() => copy(markdownUrl, 'Markdown link')}>Copy Markdown link</button>
        </>}
        <button type="button" className={buttonClass} onClick={download}>Download .md</button>
      </div>
      {isPublic && <div className="space-y-2 pt-2">
        <h3 className="text-[11px] text-muted-foreground">for agents</h3>
        <code className="block break-all text-[11.5px]">{curl}</code>
        <button type="button" className={buttonClass} disabled={busy} onClick={() => copy(curl, 'Curl command')}>Copy curl command</button>
        <a href={rawPath(profile.handle)} className="inline-block py-2 text-muted-foreground underline underline-offset-2 hover:text-foreground">open raw</a>
      </div>}
      <p role="status" aria-live="polite" aria-atomic="true" className="text-muted-foreground">{feedback}</p>
    </section>
  )
}
