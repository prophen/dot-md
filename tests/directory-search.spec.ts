import { test, expect } from '@playwright/test'

const result = (query: string, handle = 'ada') => ({
  query, matching: 'all literal keywords, case-insensitive', hasMore: false, scanTruncated: false,
  results: [{ handle, name: 'Ada', summary: 'Engineer', kind: 'person', listed: true, status: 'published',
    page: `https://example.test/p/${handle}`, raw: `https://example.test/${handle}.md`,
    evidence: [{ keyword: query, field: 'body', excerpt: `Built ${query} tooling. <script>literal source</script>` }] }],
})

test('search shows Markdown evidence, limits, empty/error recovery, and returns to browse', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const queries: string[] = []
  await page.route('**/api/public/search?**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('query')!
    queries.push(query)
    if (query.split(' ').length > 5) {
      await route.fulfill({ status: 400, json: { error: 'invalid_input' } }); return
    }
    if (query === 'failure' && queries.filter((q) => q === query).length === 1) {
      await route.fulfill({ status: 503, json: { error: 'search_unavailable' } }); return
    }
    await route.fulfill({ json: query === 'empty' ? { ...result(query), results: [], scanTruncated: true }
      : { ...result(query), hasMore: true } })
  })
  await page.goto('/people')
  const search = page.getByRole('searchbox', { name: 'Search the directory' })
  await search.fill('   ')
  await expect(page.getByRole('region', { name: 'Search results' })).toHaveCount(0)
  expect(queries).toEqual([])
  await search.fill('SQLite')
  await expect(page.getByRole('link', { name: /ada.md/ })).toHaveAttribute('href', '/p/ada')
  await expect(page.getByText('Built SQLite tooling.', { exact: false })).toContainText('<script>literal source</script>')
  await expect(page.getByText(/More matches exist/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await search.fill('a b c d e f')
  await expect(page.getByRole('alert')).toContainText('at most five keywords')
  await search.fill('empty')
  await expect(page.getByText('No matches in the profiles scanned.')).toBeVisible()
  await expect(page.getByText(/Scan limit reached/)).toBeVisible()
  await search.fill('failure')
  await expect(page.getByRole('alert')).toContainText("Couldn't search")
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('link', { name: /ada.md/ })).toBeVisible()
  await search.clear()
  await expect(page.getByRole('region', { name: 'Search results' })).toHaveCount(0)
})

test('loading and cancelled responses never show an older query', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  let started!: () => void
  const requested = new Promise<void>((resolve) => { started = resolve })
  await page.route('**/api/public/search?**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('query')!
    if (query === 'old') { started(); await held }
    await route.fulfill({ json: result(query, query) }).catch(() => {})
  })
  await page.goto('/people')
  const search = page.getByRole('searchbox')
  await search.fill('old')
  await requested
  await expect(page.getByRole('status')).toContainText('Searching')
  await search.fill('new')
  await expect(page.getByRole('link', { name: /new.md/ })).toBeVisible()
  release()
  await expect(page.getByRole('link', { name: /old.md/ })).toHaveCount(0)
  await search.clear()
  await expect(page.getByRole('region', { name: 'Search results' })).toHaveCount(0)
})
