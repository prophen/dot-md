import { test, expect } from 'deepspace/testing'

/**
 * The core loop: pick a starter, create a draft, edit, publish, then read it
 * back as a page (signed out), in the directory, and raw at /<handle>.md.
 */

const SHOTS = process.env.PROFILE_SHOTS_DIR

test('starter → draft → publish → public page, directory, and raw file', async ({ users, browser }) => {
  const [author, other] = await users(2)
  const { page } = author
  const handle = `e2e-${Date.now().toString(36)}`

  await page.goto('/edit')
  await page.getByLabel('Software engineer').check()
  await page.getByRole('textbox', { name: 'name', exact: true }).fill('Test Engineer')
  await page.getByRole('textbox', { name: /handle/ }).fill(handle)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/1-new-file.png`, fullPage: true })
  await page.getByRole('button', { name: `touch ${handle}.md` }).click()

  await expect(page).toHaveURL(/\/edit\/[^/]+$/)
  const editor = page.getByRole('textbox', { name: 'Markdown' })
  await expect(editor).toHaveValue(/## Stack/)
  await expect(editor).toHaveValue(new RegExp(`Canonical Markdown: <http://[^>]+/${handle}\\.md>`))

  const body = (await editor.inputValue()).replace(
    /^> .*$/m,
    '> Backend engineer working on payment systems. I optimize for boring, observable services.',
  )
  await editor.fill(body)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/2-editor.png`, fullPage: true })
  await expect(page.getByLabel('List me in the directory')).not.toBeChecked()
  await page.getByRole('button', { name: 'publish', exact: true }).click()
  await expect(page.getByText('published · unlisted', { exact: true })).toBeVisible()

  // Signed out: direct links work, but directory and broad queries omit it.
  const visitor = await browser.newContext()
  const anon = await visitor.newPage()
  let anonSocket = ''
  anon.on('websocket', (ws) => { if (ws.url().includes('/ws/app:')) anonSocket = ws.url() })
  await anon.goto(`/p/${handle}`)
  await expect(anon.getByRole('heading', { level: 1, name: /Test Engineer/ })).toBeVisible()
  await expect(anon.getByText('edit this file')).toHaveCount(0)
  if (SHOTS) await anon.screenshot({ path: `${SHOTS}/3-profile.png`, fullPage: true })

  await anon.goto('/people')
  const row = anon.getByRole('link', { name: new RegExp(`${handle}\\.md`) })
  await expect(anon.getByRole('heading', { name: /~\/people ·/ })).toBeVisible()
  await expect(row).toHaveCount(0)
  expect(await queryHandles(anon, anonSocket)).not.toContain(handle)

  let otherSocket = ''
  other.page.on('websocket', (ws) => { if (ws.url().includes('/ws/app:')) otherSocket = ws.url() })
  await other.page.goto('/people')
  await expect(other.page.getByRole('heading', { name: /~\/people ·/ })).toBeVisible()
  expect(await queryHandles(other.page, otherSocket)).not.toContain(handle)
  const publicJson = await anon.request.get(`/api/public/profiles/${handle}`)
  expect(publicJson.status()).toBe(200)
  expect(publicJson.headers()['cache-control']).toBe('no-store')
  expect(publicJson.headers()['x-robots-tag']).toBe('noindex')
  expect(await publicJson.json()).not.toHaveProperty('createdBy')

  await page.getByLabel('List me in the directory').check()
  await page.getByRole('button', { name: 'save', exact: true }).click()
  await expect(page.getByText('published · listed', { exact: true })).toBeVisible()
  await anon.reload()
  await expect(row).toContainText('Backend engineer working on payment systems')
  expect(await queryHandles(anon, anonSocket)).toContain(handle)

  // Removing the listing keeps direct links working, but removes query access.
  await page.getByLabel('List me in the directory').uncheck()
  await page.getByRole('button', { name: 'save', exact: true }).click()
  await expect(page.getByText('published · unlisted', { exact: true })).toBeVisible()
  expect(await queryHandles(anon, anonSocket)).not.toContain(handle)
  expect(await queryHandles(other.page, otherSocket)).not.toContain(handle)
  await anon.reload()
  await expect(row).toHaveCount(0)
  if (SHOTS) await anon.screenshot({ path: `${SHOTS}/4-directory.png`, fullPage: true })

  const raw = await anon.request.get(`/${handle}.md`)
  expect(raw.status()).toBe(200)
  expect(raw.headers()['content-type']).toContain('text/markdown')
  expect(raw.headers()['cache-control']).toBe('no-store')
  const text = await raw.text()
  expect(text).toContain('> Backend engineer working on payment systems.')
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  expect(text).toContain(`Last updated: ${today}`)
  await visitor.close()

  // Unpublished files disappear from the public surfaces.
  await page.getByRole('button', { name: 'unpublish' }).click()
  await expect(page.getByText('draft', { exact: true })).toBeVisible()
  expect((await page.request.get(`/${handle}.md`)).status()).toBe(404)
  expect((await page.request.get(`/api/public/profiles/${handle}`)).status()).toBe(404)

  page.on('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'delete this file' }).click()
  await expect(page).toHaveURL(/\/edit$/)
})

// Bypass the directory's status filter and ask the records socket for every
// profile. This proves the data layer, not just the UI, hides unlisted files.
async function queryHandles(page: import('@playwright/test').Page, socketUrl: string): Promise<string[]> {
  expect(socketUrl).toBeTruthy()
  return page.evaluate((url) => new Promise<string[]>((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => { ws.close(); reject(new Error('Query timed out')) }, 10000)
    ws.onopen = () => ws.send(JSON.stringify({ type: 'core.subscribe', payload: {
      subscriptionId: 'unfiltered-profiles', query: { collection: 'profiles', limit: 1000 },
    } }))
    ws.onerror = () => { clearTimeout(timer); ws.close(); reject(new Error('Query socket failed')) }
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type !== 'core.query_result') return
      clearTimeout(timer)
      ws.close()
      resolve(message.payload.records.map((r: { data: { handle: string } }) => r.data.handle))
    }
  }), socketUrl)
}
