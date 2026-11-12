import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProfileView } from './ProfileView'
import { profileStyle, PROFILE_STYLES } from '../lib/profile-style'

describe('profile presentation', () => {
  it('keeps old and unknown styles on Source view', () => {
    for (const value of [undefined, null, '', 'unknown', '<script>']) expect(profileStyle(value)).toBe('source')
  })
  it('preserves section and subsection heading levels in every style', () => {
    for (const style of PROFILE_STYLES) {
      const html = renderToStaticMarkup(<ProfileView body={'## Selected work\n\n### Talk to the book'} style={style} />)
      expect(html).toMatch(/<h2[^>]*>.*Selected work<\/h2>/)
      expect(html).toMatch(/<h3[^>]*>.*Talk to the book<\/h3>/)
    }
  })
  it('renders the same supplied content safely in every style', () => {
    const body = '# Ada\n\n> Works with Postgres\n\n[unsafe](javascript:alert)\n<script>alert(1)</script>'
    for (const style of PROFILE_STYLES) {
      const html = renderToStaticMarkup(<ProfileView body={body} style={style} handle="ada" />)
      expect(html).toContain(`data-profile-style="${style}"`)
      expect(html).toContain('Ada')
      expect(html).toContain('Works with Postgres')
      expect(html).not.toContain('href="javascript:')
      expect(html).not.toContain('<script>')
    }
  })
})
