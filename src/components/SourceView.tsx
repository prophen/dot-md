/**
 * Renders a markdown file the way dot-md shows every profile: line numbers in
 * a gutter, markdown syntax left visible in rust, and the words a person wrote
 * set in Newsreader. Deliberately line-based rather than a full markdown
 * parser — what an agent reads and what a person sees stay the same text.
 */

import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

const SAFE_HREF = /^(https?:\/\/|mailto:)/i

/** `**bold**`, `*em*`/`_em_`, `` `code` ``, `[text](url)` and `<url>`;
 *  everything else is literal. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|<(?:https?:\/\/|mailto:)?[^<>\s]+[@.][^<>\s]+>|(?<![\w*])\*[^*\s][^*]*\*(?!\*)|(?<!\w)_[^_\s][^_]*_(?!\w))/g
  let last = 0
  let i = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) {
      out.push(
        <strong key={i++} className="font-semibold">
          <span className="source-syntax text-mark">**</span>
          {tok.slice(2, -2)}
          <span className="source-syntax text-mark">**</span>
        </strong>,
      )
    } else if (tok.startsWith('`')) {
      out.push(
        <code key={i++} className="bg-muted px-1 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      )
    } else if (tok.startsWith('<')) {
      const target = tok.slice(1, -1)
      const href = /^[^:/]+@[^/]+$/.test(target) ? `mailto:${target}` : target
      out.push(
        <span key={i++}>
          <span className="source-syntax text-mark">&lt;</span>
          {SAFE_HREF.test(href) ? (
            <a href={href} rel="noopener noreferrer nofollow" target="_blank" className="break-all underline decoration-mark underline-offset-2 hover:text-mark">
              {target}
            </a>
          ) : (
            target
          )}
          <span className="source-syntax text-mark">&gt;</span>
        </span>,
      )
    } else if (tok.startsWith('*') || tok.startsWith('_')) {
      out.push(
        <em key={i++}>
          <span className="source-syntax not-italic text-mark">{tok[0]}</span>
          {tok.slice(1, -1)}
          <span className="source-syntax not-italic text-mark">{tok[0]}</span>
        </em>,
      )
    } else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!
      out.push(
        <span key={i++}>
          <span className="source-syntax text-mark">[</span>
          {SAFE_HREF.test(href) ? (
            <a href={href} rel="noopener noreferrer nofollow" target="_blank" className="underline decoration-mark underline-offset-2 hover:text-mark">
              {label}
            </a>
          ) : (
            label
          )}
          <span className="source-syntax text-mark">]</span>
        </span>,
      )
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function Line({ text, continues }: { text: string; continues: boolean }) {
  if (continues) {
    return (
      <p className="font-mono text-[12.5px]" style={{ paddingLeft: `${text.length - text.trimStart().length}ch` }}>
        {inline(text.trimStart())}
      </p>
    )
  }

  const heading = /^(#{1,3}) (.*)$/.exec(text)
  if (heading) {
    const level = heading[1].length
    const marker = <span className="source-syntax text-mark">{heading[1]} </span>
    if (level === 1) {
      return (
        <h1 className="font-serif text-[clamp(1.75rem,4vw,2.25rem)] font-semibold leading-tight tracking-[-0.01em]">
          {marker}
          {heading[2]}
        </h1>
      )
    }
    return (
      <h2 className={cn('font-mono font-medium', level === 2 ? 'text-[13px]' : 'text-[12.5px] text-muted-foreground')}>
        {marker}
        {heading[2]}
      </h2>
    )
  }

  const item = /^(\s*)([-*]) (.*)$/.exec(text)
  if (item) {
    const kv = /^([\w][\w '-]{0,30}):(\s.*)?$/.exec(item[3])
    return (
      <p className="font-mono text-[12.5px]" style={{ paddingLeft: `${item[1].length}ch` }}>
        <span className="source-syntax text-mark">{item[2]} </span>
        {kv ? (
          <>
            <span className="text-muted-foreground">{kv[1]}:</span>
            {inline(kv[2] ?? '')}
          </>
        ) : (
          inline(item[3])
        )}
      </p>
    )
  }

  if (text.startsWith('|')) {
    return (
      <p className="whitespace-pre-wrap font-mono text-[12px] text-muted-foreground">
        {text.split('|').map((cell, n, all) => (
          <span key={n}>
            {n > 0 && <span className="source-syntax text-mark">|</span>}
            {/^[\s:-]+$/.test(cell) || n === 0 || n === all.length - 1 ? cell : <span className="text-foreground">{inline(cell)}</span>}
          </span>
        ))}
      </p>
    )
  }

  if (text.trimStart().startsWith('<!--')) {
    return <p className="source-comment font-mono text-[12px] text-faint">{text}</p>
  }

  const quote = /^> ?(.*)$/.exec(text)
  if (quote) {
    return (
      <p className="font-serif text-[16px] italic">
        <span className="source-syntax not-italic text-mark">&gt; </span>
        {inline(quote[1])}
      </p>
    )
  }

  if (!text.trim()) return <span aria-hidden>&nbsp;</span>
  return <p className="font-serif text-[16px] leading-[1.55]">{inline(text)}</p>
}

export function SourceView({ body, className }: { body: string; className?: string }) {
  const lines = body.replace(/\s+$/, '').split('\n')
  // An indented line right after a list item (or its continuation) belongs to
  // that item, so it keeps the item's mono setting instead of becoming prose.
  let inItem = false
  const continues = lines.map((text) => {
    const isItem = /^\s*[-*] /.test(text)
    const cont = !isItem && inItem && /^\s{2,}\S/.test(text)
    inItem = isItem || cont
    return cont
  })
  return (
    <div className={cn('source-lines grid grid-cols-[2.25rem_1fr] gap-y-[3px]', className)}>
      {lines.map((text, n) => (
        <div key={n} className="contents">
          <span
            aria-hidden
            className="source-line-number select-none pr-3 pt-[3px] text-right font-mono text-[11px] leading-[1.75] text-faint"
          >
            {n + 1}
          </span>
          <div className="source-content min-w-0 break-words leading-[1.75]">
            <Line text={text} continues={continues[n]} />
          </div>
        </div>
      ))}
    </div>
  )
}
