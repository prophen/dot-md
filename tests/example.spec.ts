import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const body = readFileSync(new URL('../src/examples/person.md', import.meta.url), 'utf8')

test('anonymous visitor can read the example and its exact raw source without auth or records', async ({ page }) => {
  const offenders: string[] = []
  page.on('request', (request) => {
    if (/\/api\/(auth|records|actions)\//.test(request.url())) offenders.push(request.url())
  })
  page.on('websocket', (socket) => {
    if (new URL(socket.url()).pathname.startsWith('/ws/')) offenders.push(socket.url())
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByRole('link', { name: 'Read an example · no sign-in' }).click()
  await expect(page).toHaveURL(/\/example$/)
  await expect(page.getByRole('heading', { name: '# Rosa Lindqvist' })).toBeVisible()
  await expect(page.getByText('Illustration only · not a live search or model response')).toBeVisible()
  const profile = page.getByRole('article', { name: 'Rosa’s example profile' })
  for (const line of body.trim().split('\n').filter(Boolean)) {
    await expect(profile).toContainText(line)
  }
  await expect(page.getByTestId('auth-overlay')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Paste text or choose a starter →' })).toHaveAttribute('href', '/edit')
  await expect(page.getByRole('link', { name: 'Set up your agent →' })).toHaveAttribute('href', '/edit#agent-access')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('link', { name: 'Raw Markdown', exact: true }).click()
  await expect(page).toHaveURL(/\/example\/person.md$/)
  expect(await page.locator('body').innerText()).toContain('Fictional example')
  const raw = await page.request.get('/example/person.md')
  expect(raw.status()).toBe(200)
  expect(raw.headers()['content-type']).toContain('text/markdown')
  expect(raw.headers()['access-control-allow-origin']).toBe('*')
  expect(await raw.text()).toBe(body)
  expect(offenders).toEqual([])
})

test('example deep link works anonymously and real search never inserts the fixture', async ({ page }) => {
  await page.goto('/example')
  await expect(page.getByRole('heading', { name: '# Rosa Lindqvist' })).toBeVisible()
  const href = await page.getByRole('link', { name: 'Run this search on the real directory (JSON)' }).getAttribute('href')
  expect(href).toBe('/api/public/search?query=Postgres%20async&limit=5')
  const response = await page.request.get(href!)
  expect(response.status()).toBe(200)
  const result = await response.json()
  expect(result.query).toBe('Postgres async')
  expect(Array.isArray(result.results)).toBe(true)
  for (const match of result.results) {
    expect(match.page).toContain('/p/')
    expect(match.raw).not.toContain('/example/')
  }
  await expect(page.getByTestId('auth-overlay')).toHaveCount(0)
})
