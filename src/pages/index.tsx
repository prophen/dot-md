/**
 * Landing page — a STATIC page (no auth, no records socket), prerendered at
 * build so crawlers and agents read real text. The page is itself a markdown
 * file, which is the whole pitch.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const SAMPLE = [
  ['#', ' Rosa Lindqvist', 'h1'],
  ['', "Builds billing systems that don't page anyone at 3am.", 'p'],
  ['', '', 'blank'],
  ['##', ' Working with me', 'h2'],
  ['-', ' prefers: async, written specs', 'li'],
  ['-', ' timezone: Europe/Stockholm', 'li'],
  ['-', ' ask me about: Postgres, ledgers', 'li'],
] as const

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="mx-auto max-w-5xl px-4 sm:px-6">
        <header className="flex h-12 items-center justify-between">
          <span className="text-[13px] font-semibold">
            <span className="text-mark">.</span>md
          </span>
          <Link to="/people" className="text-[12.5px] text-muted-foreground hover:text-foreground">
            ~/people
          </Link>
        </header>

        <section className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h1 className="font-serif text-[clamp(2.25rem,6vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.015em]">
              A person<span className="text-mark">.md</span> file,
              <br />
              at a URL that's yours.
            </h1>
            <p className="mt-6 max-w-[34rem] font-serif text-[19px] leading-[1.5] text-muted-foreground">
              Write down how you work, what you know, and how to reach you — once, in plain markdown.
              People read it as a profile. Agents fetch the same file before they email you, book you,
              or write on your behalf.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px]">
              <Link
                to="/edit"
                className="border border-foreground bg-foreground px-3.5 py-2 text-background hover:bg-transparent hover:text-foreground"
              >
                Write yours
              </Link>
              <Link to="/people" className="underline decoration-mark underline-offset-4 hover:text-mark">
                Browse the directory
              </Link>
            </div>
          </div>

          <figure className="border border-border bg-card p-5 sm:p-6" aria-label="An example person.md file">
            <figcaption className="mb-4 text-[11px] text-muted-foreground">rosa-lindqvist / person.md</figcaption>
            <div className="grid grid-cols-[1.75rem_1fr] gap-y-[3px] leading-[1.75]">
              {SAMPLE.map(([mark, text, kind], n) => (
                <div key={n} className="contents">
                  <span aria-hidden className="select-none pr-2 pt-[3px] text-right text-[11px] text-faint">
                    {n + 1}
                  </span>
                  {kind === 'h1' ? (
                    <span className="font-serif text-[26px] font-semibold leading-tight">
                      <span className="text-mark">{mark}</span>
                      {text}
                    </span>
                  ) : kind === 'p' ? (
                    <span className="font-serif text-[15.5px]">{text}</span>
                  ) : kind === 'blank' ? (
                    <span>&nbsp;</span>
                  ) : (
                    <span className="text-[12.5px]">
                      <span className="text-mark">{mark}</span>
                      {text}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-dotted border-input pt-3 text-[11.5px] text-muted-foreground">
              $ curl dot-md.app.space/rosa-lindqvist.md
            </div>
          </figure>
        </section>

        <section className="grid gap-8 border-t border-border py-14 text-[13px] sm:grid-cols-3">
          <div>
            <h2 className="mb-2 text-[11px] text-muted-foreground">01 · write</h2>
            <p className="font-serif text-[16px] leading-[1.5]">
              Start from a short template. Headings, lists, links — nothing you need a manual for.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-[11px] text-muted-foreground">02 · publish</h2>
            <p className="font-serif text-[16px] leading-[1.5]">
              Drafts stay private. Publishing lists you in the directory under a handle that never changes.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-[11px] text-muted-foreground">03 · point agents at it</h2>
            <p className="font-serif text-[16px] leading-[1.5]">
              Every profile is served raw at <code className="font-mono text-[13px]">/handle.md</code>. Paste
              the link into a prompt, a system file, or an email signature.
            </p>
          </div>
        </section>

        <footer className="border-t border-border py-6 text-[11.5px] text-muted-foreground">
          <span className="text-mark">.</span>md — plain-text profiles for people and the agents that work with them.
        </footer>
      </div>
    </>
  )
}
