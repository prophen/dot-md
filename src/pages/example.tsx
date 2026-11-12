import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { SourceView } from '../components/SourceView'
import body from '../examples/person.md?raw'
import { seo } from '../seo'

const link = 'underline decoration-mark underline-offset-4 hover:text-mark'
const search = '/api/public/search?query=Postgres%20async&limit=5'

export default function Example() {
  return (
    <>
      <Seo {...seo} path="/example" title="A fictional person.md · dot-md" description="Read a fictional profile, fetch its Markdown, and follow an agent discovery walkthrough. No sign-in required." />
      <link rel="alternate" type="text/markdown" href="/example/person.md" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-4 text-[12.5px]">
          <Link to="/" aria-label="dot-md home"><span className="text-mark">.</span>md / example</Link>
          <Link to="/edit" className={link}>Write yours</Link>
        </header>
        <main className="pb-16">
          <section className="border-t border-border pt-10" aria-label="Fictional profile">
            <p className="mb-3 text-[11px] uppercase tracking-wider text-mark">Fictional example · no sign-in required</p>
            <p className="mb-6 max-w-prose font-serif text-lg text-muted-foreground">
              One file, two ways to read it. This sample lives outside the directory; it is not a real account.
            </p>
            <nav aria-label="Example views" className="mb-8 flex flex-wrap gap-5 text-[12px]">
              <a href="#profile" className={link}>Readable profile</a>
              <a href="/example/person.md" className={link}>Raw Markdown</a>
              <a href="#discovery" className={link}>How discovery works</a>
            </nav>
            <article id="profile" className="scroll-mt-6 border-y border-border py-7" aria-label="Rosa’s example profile">
              <SourceView body={body} />
            </article>
            <p className="mt-4 font-serif text-base text-muted-foreground">
              Opportunities are optional. Rosa’s example spells out contracts, collaboration, and working preferences
              in the file itself. You can leave that section out of your own profile.
            </p>
          </section>

          <section id="discovery" className="scroll-mt-6 pt-14" aria-labelledby="discovery-heading">
            <p className="text-[11px] text-muted-foreground">01 · find a person</p>
            <h2 id="discovery-heading" className="mt-2 font-serif text-3xl font-semibold">From a question to a source.</h2>
            <p className="mt-4 font-serif text-lg">“Who works with Postgres and prefers async communication?”</p>
            <p className="mt-3 font-serif text-base text-muted-foreground">
              An agent can turn that question into the keywords <code>Postgres async</code>.
              Search checks every keyword against listed profiles and returns excerpts with readable and raw links.
              It matches literal text, not meaning, and orders results by handle, not quality.
            </p>
            <pre className="my-5 overflow-x-auto border-y border-border py-4 text-[12px]" aria-label="HTTP search request">GET {search}</pre>
            <aside className="border-l-2 border-mark pl-4" aria-label="Illustrative search evidence">
              <h3 className="text-[12px] font-semibold">Illustration only · not a live search or model response</h3>
              <p className="mt-3 font-serif text-base">Rosa’s sample contains both keywords:</p>
              <ul className="mt-3 space-y-2 text-[12.5px]">
                <li><strong>Postgres</strong> → “ask me about: Postgres, ledgers”</li>
                <li><strong>async</strong> → “prefers: async, written specs”</li>
              </ul>
              <p className="mt-4 flex flex-wrap gap-5 text-[12px]">
                <a href="#profile" className={link}>Read the example profile</a>
                <a href="/example/person.md" className={link}>Fetch the source</a>
              </p>
            </aside>
            <p className="mt-5 font-serif text-base text-muted-foreground">
              <a href={search} className={link}>Run this search on the real directory (JSON)</a>.
              No token is needed. Results may be empty; this fictional example will not appear.
              Drafts and unlisted files are excluded. The response flags when more matches exist or the scan is incomplete.
            </p>
            <p className="mt-7 text-[11px] text-muted-foreground">02 · read before acting</p>
            <p className="mt-2 font-serif text-base">
              Follow a result’s <code>page</code> or <code>raw</code> link to check the full file.
              Excerpts are evidence of words, not an endorsement or permission to contact someone.
              Read their current availability and contact preferences before proposing a next step.
            </p>
          </section>

          <section className="mt-14 border-t border-border pt-8" aria-labelledby="start-heading">
            <p className="text-[11px] text-muted-foreground">03 · make it yours</p>
            <h2 id="start-heading" className="mt-2 font-serif text-3xl font-semibold">Start with what you already wrote.</h2>
            <p className="mt-4 font-serif text-base">
              Sign in, paste a bio or README, then review the Markdown. Or choose a starter.
              Your file stays a private draft until you publish it. Add opportunities only if you want to.
            </p>
            <p className="mt-5 text-[13px]"><Link to="/edit" className={link}>Paste text or choose a starter →</Link></p>
            <h3 className="mt-8 font-serif text-xl font-semibold">Connect an agent</h3>
            <p className="mt-3 font-serif text-base text-muted-foreground">
              Reading public Markdown and searching the directory need no account. To let an agent manage your own
              files, sign in and create a token under “Connect an agent” on the writing page. Use its setup instructions
              with your MCP client at <code>/agent/mcp</code>. The token acts as you and can publish files;
              keep it private and revoke it there when you’re done.
            </p>
            <p className="mt-5 text-[13px]"><Link to="/edit#agent-access" className={link}>Set up your agent →</Link></p>
          </section>
        </main>
        <footer className="border-t border-border py-6 text-[12px]"><Link to="/people" className={link}>Browse real profiles →</Link></footer>
      </div>
    </>
  )
}
