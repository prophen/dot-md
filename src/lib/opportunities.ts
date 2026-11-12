/** The Markdown is the only stored state. Never interpret unmarked prose as consent. */
export const OPEN_TO = ['jobs', 'contracts', 'collaboration', 'speaking', 'mentoring'] as const
export interface Opportunities {
  openTo: (typeof OPEN_TO)[number][]
  availability: string
  workPreferences: string
}
const START = '<!-- dot-md:opportunities -->'
const END = '<!-- /dot-md:opportunities -->'
const INVALID = 'The opportunities section has custom or incomplete Markdown. Edit or remove its marked block in Markdown before using these controls.'
const empty = (): Opportunities => ({ openTo: [], availability: '', workPreferences: '' })

export function readOpportunities(body: string): { value: Opportunities; error?: string; range?: [number, number] } {
  const markers: { text: string; start: number; end: number }[] = []
  let fence = ''
  for (const match of body.matchAll(/[^\n]*(?:\n|$)/g)) {
    const text = match[0].replace(/\r?\n$/, '')
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text)
    if (delimiter) {
      if (!fence) fence = delimiter[1]
      else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = ''
      continue
    }
    if (!fence && /<!--\s*\/?dot-md:opportunities/.test(text)) {
      markers.push({ text, start: match.index, end: match.index + match[0].length })
    }
  }
  if (!markers.length) return { value: empty(), ...(fence ? { error: 'Close the Markdown code fence before adding opportunities.' } : {}) }
  if (markers.length !== 2 || markers[0].text !== START || markers[1].text !== END) return { value: empty(), error: INVALID }
  const [start, end] = markers
  const lines = body.slice(start.end, end.start).split(/\r?\n/).filter((line) => line.trim())
  if (lines.shift() !== '## Opportunities') return { value: empty(), error: INVALID }
  const value = empty()
  const seen = new Set<string>()
  for (const line of lines) {
    const field = /^- (Open to|Availability|Work preferences): (.*)$/.exec(line)
    if (!field || seen.has(field[1])) return { value: empty(), error: INVALID }
    seen.add(field[1])
    if (field[1] === 'Open to') {
      const choices = field[2].split(', ').filter(Boolean)
      if (choices.some((choice) => !OPEN_TO.includes(choice as typeof OPEN_TO[number])) || new Set(choices).size !== choices.length) return { value: empty(), error: INVALID }
      value.openTo = choices as Opportunities['openTo']
    } else if (field[1] === 'Availability') value.availability = field[2]
    else value.workPreferences = field[2]
  }
  return { value, range: [start.start, end.end] }
}

/** Replace only a recognized block; custom content anywhere else stays byte-for-byte. */
export function writeOpportunities(body: string, value: Opportunities): string {
  const current = readOpportunities(body)
  if (current.error) throw new Error(current.error)
  if (value.openTo.some((choice) => !OPEN_TO.includes(choice)) ||
      [value.availability, value.workPreferences].some((text) => /[\r\n]/.test(text) || text.includes('dot-md:opportunities'))) {
    throw new Error('Use the supported choices and single-line availability and work preferences.')
  }
  const eol = body.includes('\r\n') ? '\r\n' : '\n'
  const fields = [
    ...(value.openTo.length ? [`- Open to: ${OPEN_TO.filter((choice) => value.openTo.includes(choice)).join(', ')}`] : []),
    ...(value.availability ? [`- Availability: ${value.availability}`] : []),
    ...(value.workPreferences ? [`- Work preferences: ${value.workPreferences}`] : []),
  ]
  const section = fields.length ? [START, '## Opportunities', '', ...fields, END, ''].join(eol) : ''
  const next = current.range
    ? body.slice(0, current.range[0]) + section + body.slice(current.range[1])
    : section ? body + (body && !body.endsWith(eol + eol) ? (body.endsWith(eol) ? eol : eol + eol) : '') + section : body
  if (next.length > 20000) throw new Error('Keep the file at 20,000 characters or fewer; nothing has been truncated.')
  return next
}
