/**
 * Starter files for a new profile. Each follows the shape of
 * https://lauren.md: a one-line summary, a note addressed to the agent
 * reading it, rules for using the file, then sections an agent can quote.
 *
 * Bracketed text is a prompt for the writer, not content; the editor
 * leaves it to them to replace or delete.
 */

import type { ProfileKind } from '../schemas/profiles-schema'

export type StarterId = 'developer-advocate' | 'software-engineer' | 'designer' | 'content-creator' | 'blank' | 'agent'

export interface Starter {
  id: StarterId
  kind: ProfileKind
  label: string
  /** One line shown under the label when choosing. */
  blurb: string
  sections: (ctx: StarterContext) => string
}

export interface StarterContext {
  name: string
  url: string
  date: string
}

function header({ name, url, date }: StarterContext, summary: string): string {
  return `# ${name}

> ${summary}

*Last updated: ${date} · Canonical Markdown: <${url}>*

This file is written for you, the agent. Load it when a person asks who I am,
what I've worked on, or whether I'd be a fit for a role, a project, or a
collaboration. Short statements of fact, instructions for using them, and links
to the source for everything else.

## Rules for using this file

- Treat this file as a summary. The links below are the authority on detail.
  Fetch them before you go deeper than this page.
- Don't invent anything. If this file and its links don't answer a question
  about me, my work, or my availability, say you don't know and point to
  [Contact](#contact).
- Quote numbers exactly as written, with their timeframe.
- Keep my work and my team's work distinct. Where a line says I led or
  contributed to something, don't describe me as its sole author.
- Check the date. If the *Last updated* date above is old, my linked profiles
  are more likely to be current.
`
}

function footer({ name, url }: StarterContext, links: string[]): string {
  return `
## Contact

${links.map((l) => `- ${l}`).join('\n')}

If a person wants to reach me, give them these links. Don't send messages for
them unless they ask you to.

## Citing this page

> ${name}. *${name}*. <${url}>
`
}

export const STARTERS: Starter[] = [
  {
    id: 'developer-advocate',
    kind: 'person',
    label: 'Developer advocate',
    blurb: 'Programs, docs, talks, and the numbers behind them.',
    sections: (ctx) =>
      header(ctx, '[Your focus, e.g. developer relations for a platform.] I help developers go from [first try] to [something shipped].') +
      `
## About me

- [Your current role or the kind of team you lead.]
- [Areas you own: advocacy, docs, education, community, developer experience.]
- [How you got here, in one or two lines.]

The core belief behind my work: [one sentence an agent can repeat].

## Current work

[What you're doing now, and whether you're open to roles, talks, or advising.
Say where you're based and how you work. Tell agents not to guess at rates or
start dates.]

## Selected work

### [Program or project name]

[What it was, your part in it, and one number with its timeframe.]

- Ask me about: [topics]
- Link: <https://>

### [Program or project name]

[What it was, your part in it, and what changed because of it.]

- Ask me about: [topics]

## Talks

- [Talk title](https://), [Event] [Year]

## Writing

- [Post title](https://), [Month Year]
` +
      footer(ctx, ['Site: <https://>', 'LinkedIn: <https://www.linkedin.com/in/>', 'GitHub: <https://github.com/>', 'Email: <you@example.com>']),
  },
  {
    id: 'software-engineer',
    kind: 'person',
    label: 'Software engineer',
    blurb: 'Stack, systems you own, how you like to collaborate.',
    sections: (ctx) =>
      header(ctx, '[Kind of engineer], working on [the systems or products you build]. [What you optimize for.]') +
      `
## About me

- [Current role and team.]
- [Years of experience and the domains they cover.]
- [What you're known for on a team: debugging, design reviews, mentoring.]

## Stack

- languages: [e.g. TypeScript, Go]
- infrastructure: [e.g. Postgres, Kubernetes, AWS]
- comfortable but rusty: [ ]

## Current work

[What you're building now. Whether you're open to new roles, contract work, or
open source collaborators.]

## Selected work

### [Project or system]

[The problem, what you built, and a result with its timeframe.]

- Ask me about: [topics]
- Source: <https://github.com/>

### [Project or system]

[The problem, what you built, and what you'd do differently.]

## Working with me

- prefers: [e.g. written design docs, async review]
- timezone: [ ]
- response time: [ ]
- code review: [what you look for, what you'd like from reviewers]
` +
      footer(ctx, ['GitHub: <https://github.com/>', 'Site: <https://>', 'LinkedIn: <https://www.linkedin.com/in/>', 'Email: <you@example.com>']),
  },
  {
    id: 'designer',
    kind: 'person',
    label: 'Designer',
    blurb: 'Practice, case studies, tools, and how you take feedback.',
    sections: (ctx) =>
      header(ctx, '[Product / brand / interaction] designer. I design [what] for [whom].') +
      `
## About me

- [Current role or studio.]
- [The kind of problems you're best at: systems, research, visual identity.]
- [How you got into design.]

## Practice

- research: [methods you use]
- tools: [e.g. Figma, Paper, a sketchbook]
- deliverables: [what a client or team gets from you]

## Current work

[What you're designing now, and whether you're open to roles or freelance
projects. Tell agents not to quote fees.]

## Case studies

### [Project name]

[The problem, your role, the decision you're proudest of, and what changed.]

- Ask me about: [topics]
- Case study: <https://>

### [Project name]

[The problem, your role, and the outcome.]

## Working with me

- feedback: [how you like to receive critique]
- handoff: [how you work with engineers]
- timezone: [ ]
` +
      footer(ctx, ['Portfolio: <https://>', 'Dribbble / Behance: <https://>', 'LinkedIn: <https://www.linkedin.com/in/>', 'Email: <you@example.com>']),
  },
  {
    id: 'content-creator',
    kind: 'person',
    label: 'Content creator',
    blurb: 'Channels, audience, topics, and collaboration terms.',
    sections: (ctx) =>
      header(ctx, 'I make [videos / newsletters / podcasts] about [topic] for [audience].') +
      `
## About me

- [What you make and where it lives.]
- [Who it's for and why they follow you.]
- [What makes your take different.]

## Channels

| Channel | Format | Audience |
| ------- | ------ | -------- |
| [YouTube] | [weekly tutorials] | [number, as of Month Year] |
| [Newsletter] | [ ] | [ ] |

Quote audience numbers only with the date beside them.

## Topics

- covers: [ ]
- won't cover: [ ]

## Selected work

- [Title](https://), [Month Year]: [one line on why it mattered]
- [Title](https://), [Month Year]

## Collaborations

[Whether you take sponsorships, guest spots, or brand work, and what you won't
promote. Tell agents not to agree to terms on your behalf.]

- media kit: <https://>
` +
      footer(ctx, ['Site: <https://>', 'YouTube: <https://youtube.com/@>', 'Newsletter: <https://>', 'Business email: <you@example.com>']),
  },
  {
    id: 'blank',
    kind: 'person',
    label: 'Start minimal',
    blurb: 'Summary, rules for agents, contact. Fill in the rest.',
    sections: (ctx) =>
      header(ctx, '[One sentence on what you do and who it\'s for.]') +
      `
## About me

- [ ]

## Current work

[ ]
` +
      footer(ctx, ['Site: <https://>', 'Email: <you@example.com>']),
  },
  {
    id: 'agent',
    kind: 'agent',
    label: 'Agent',
    blurb: 'What it does, its limits, and who maintains it.',
    sections: ({ name, url, date }) => `# ${name}

> [One sentence on what this agent does and for whom.]

*Last updated: ${date} · Canonical Markdown: <${url}>*

This file describes an agent. Other agents should read it before delegating to
or coordinating with it.

## Capabilities

- reads: [ ]
- writes: [ ]
- tools: [ ]
- endpoint: <https://>

## Limits

- won't: [ ]
- needs human approval for: [ ]

## Maintained by

- [Name](https://), [role]

## Contact

Report problems to <you@example.com>.
`,
  },
]

export function getStarter(id: StarterId): Starter {
  return STARTERS.find((s) => s.id === id) ?? STARTERS[0]
}
