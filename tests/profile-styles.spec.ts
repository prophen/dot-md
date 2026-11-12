import { test, expect } from 'deepspace/testing'

test('profile styles save independently of Markdown and publication', async ({ users, browser }) => {
  const [author] = await users(1)
  const page = author.page
  const handle = `styles-${Date.now().toString(36)}`
  const body = '# Style Tester\n\n> A profile with the same words in every style.\n\n## Work\n\n- Postgres\n\nLast updated: 2020-01-01\n'
  await page.goto('/edit')
  await page.getByLabel('Paste your text').fill(body)
  await page.getByRole('button', { name: 'Prepare draft' }).click()
  await page.getByRole('textbox', { name: 'name', exact: true }).fill('Style Tester')
  await page.getByRole('textbox', { name: /handle/ }).fill(handle)
  await page.getByRole('button', { name: 'save draft', exact: true }).click()
  await expect(page).toHaveURL(/\/edit\/[^/]+$/)
  const visitor = await browser.newContext()
  const anon = await visitor.newPage()
  try {
    await expect(page.locator('[data-profile-style="source"]')).toBeVisible()
    await page.getByRole('button', { name: 'publish', exact: true }).click()
    await expect(page.getByText('published · unlisted', { exact: true })).toBeVisible()
    const original = await (await anon.request.get(`/${handle}.md`)).text()
    expect(original).toBe(body)
    for (const [name, id] of [['Field guide', 'field-guide'], ['Registry', 'registry'], ['Source view', 'source']]) {
      await page.getByRole('radio', { name: new RegExp(name) }).check()
      await expect(page.locator(`[data-profile-style="${id}"]`)).toBeVisible()
      await page.getByRole('button', { name: 'save', exact: true }).click()
      await expect(page.getByRole('button', { name: 'save', exact: true })).toBeDisabled()
      await page.reload()
      await expect(page.getByRole('radio', { name: new RegExp(name) })).toBeChecked()
      await anon.setViewportSize({ width: 375, height: 812 })
      await anon.goto(`/p/${handle}`)
      const view = anon.locator(`[data-profile-style="${id}"]`)
      await expect(view).toBeVisible()
      await expect(view.getByRole('heading', { name: /Style Tester/ })).toBeVisible()
      expect(await (await anon.request.get(`/${handle}.md`)).text()).toBe(original)
      expect(await view.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      expect((await (await anon.request.get(`/api/public/profiles/${handle}`)).json()).data.status).toBe('unlisted')
    }
  } finally {
    await visitor.close()
    page.on('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'delete this file' }).click()
    await expect(page).toHaveURL(/\/edit$/)
  }
})

test('visitors can try all three styles on the example', async ({ page }) => {
  await page.goto('/example')
  for (const [name, id] of [['Field guide', 'field-guide'], ['Registry', 'registry'], ['Source view', 'source']]) {
    await page.getByRole('radio', { name: new RegExp(name) }).check()
    const view = page.locator(`[data-profile-style="${id}"]`)
    await expect(view).toBeVisible()
    if (process.env.PROFILE_SHOTS_DIR) {
      await view.screenshot({ path: `${process.env.PROFILE_SHOTS_DIR}/style-${id}.png` })
    }
  }
})
