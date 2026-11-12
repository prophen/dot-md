import { test, expect } from 'deepspace/testing'

/**
 * The core loop: pick a starter, create a draft, edit, publish, then read it
 * back as a page (signed out), in the directory, and raw at /<handle>.md.
 */

const SHOTS = process.env.PROFILE_SHOTS_DIR

test('starter → draft → publish → public page, directory, and raw file', async ({ users, browser }) => {
  const [author] = await users(1)
  const { page } = author
  const handle = `e2e-${Date.now().toString(36)}`

  await page.goto('/edit')
  await page.getByLabel('Software engineer').check()
  await page.getByRole('textbox', { name: 'name' }).fill('Test Engineer')
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
  await page.getByRole('button', { name: 'publish' }).click()
  await expect(page.getByText('published', { exact: true })).toBeVisible()

  // Signed out: the profile page and the directory both show it.
  const visitor = await browser.newContext()
  const anon = await visitor.newPage()
  await anon.goto(`/p/${handle}`)
  await expect(anon.getByRole('heading', { level: 1, name: /Test Engineer/ })).toBeVisible()
  await expect(anon.getByText('edit this file')).toHaveCount(0)
  if (SHOTS) await anon.screenshot({ path: `${SHOTS}/3-profile.png`, fullPage: true })

  await anon.goto('/people')
  const row = anon.getByRole('link', { name: new RegExp(`${handle}\\.md`) })
  await expect(row).toContainText('Backend engineer working on payment systems')
  if (SHOTS) await anon.screenshot({ path: `${SHOTS}/4-directory.png`, fullPage: true })

  const raw = await anon.request.get(`/${handle}.md`)
  expect(raw.status()).toBe(200)
  expect(raw.headers()['content-type']).toContain('text/markdown')
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

  page.on('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'delete this file' }).click()
  await expect(page).toHaveURL(/\/edit$/)
})
