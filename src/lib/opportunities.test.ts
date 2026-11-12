import { describe, expect, it } from 'vitest'
import { OPEN_TO, readOpportunities, writeOpportunities } from './opportunities'

const empty = { openTo: [], availability: '', workPreferences: '' }
const chosen = { openTo: [...OPEN_TO], availability: 'From January', workPreferences: 'Remote & async' }

describe('Markdown opportunity preferences', () => {
  it('does not infer preferences from prose or custom headings', () => {
    const body = '# Ada\n\n## Opportunities\nOpen to jobs and speaking.\n\n## Custom\nKeep this.'
    expect(readOpportunities(body).value).toEqual(empty)
    expect(writeOpportunities(body, empty)).toBe(body)
    const next = writeOpportunities(body, chosen)
    expect(next.startsWith(body)).toBe(true)
    expect(readOpportunities(next).value).toEqual(chosen)
  })
  it('edits, reads raw edits, clears, and preserves all surrounding bytes including CRLF', () => {
    for (const eol of ['\n', '\r\n']) {
      const before = `# Ada${eol}${eol}Custom prose.  ${eol}${eol}`
      const after = `${eol}## Custom tail${eol}- Keep me  ${eol}`
      const body = writeOpportunities(before, chosen) + after
      const raw = body.replace('From January', 'Next year').replace('jobs, contracts, collaboration, speaking, mentoring', 'mentoring')
      expect(readOpportunities(raw).value).toEqual({ ...chosen, openTo: ['mentoring'], availability: 'Next year' })
      const edited = writeOpportunities(raw, { ...empty, workPreferences: 'Local' })
      expect(edited.startsWith(before)).toBe(true)
      expect(edited.endsWith(after)).toBe(true)
      expect(readOpportunities(edited).value).toEqual({ ...empty, workPreferences: 'Local' })
      expect(writeOpportunities(edited, empty)).toBe(before + after)
      expect(readOpportunities(before + after).value).toEqual(empty)
    }
  })
  it('refuses destructive replacement of malformed, duplicated, or custom blocks', () => {
    const valid = writeOpportunities('# Ada', chosen)
    for (const body of [valid + valid, valid.replace('<!-- /dot-md:opportunities -->', ''), valid.replace('## Opportunities', '## Custom'), valid.replace('- Open to:', '- Unknown:'), valid.replace('jobs, contracts', 'unknown, contracts'), valid.replace('## Opportunities', '## Opportunities\nCustom prose'), valid.replace('- Availability: From January', '- Availability: One\n- Availability: Two')]) {
      expect(readOpportunities(body).error).toBeTruthy()
      expect(() => writeOpportunities(body, empty)).toThrow()
    }
  })
  it('ignores fenced examples, refuses open fences and rejects oversized or multiline edits', () => {
    const example = '```md\n' + writeOpportunities('', chosen) + '```\n'
    expect(readOpportunities(example).value).toEqual(empty)
    expect(writeOpportunities(example, chosen).startsWith(example)).toBe(true)
    expect(() => writeOpportunities('```\nunclosed', chosen)).toThrow(/fence/)
    expect(() => writeOpportunities('x'.repeat(19999), chosen)).toThrow(/20,000/)
    expect(() => writeOpportunities('', { ...chosen, availability: 'a\nb' })).toThrow(/single-line/)
  })
})
