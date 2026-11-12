import { readFile } from 'node:fs/promises'
import { test, expect } from 'deepspace/testing'
import type { Page } from '@playwright/test'

async function expectDownload(page: Page, handle: string, body: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download .md', exact: true }).click()
  const download = await pending
  expect(download.suggestedFilename()).toBe(`${handle}.md`)
  expect(await readFile((await download.path())!, 'utf8')).toBe(body)
}

test('profile sharing copies canonical links, handles clipboard denial, and preserves downloads and draft privacy', async ({ users, browser }) => {
  const [author] = await users(1)
  const page = author.page
  const handle = `share-${Date.now().toString(36)}`
  const body = '# Sharing Tester\n\n> Café & Markdown\n\n- Keep **formatting**  \n\nNo final newline'
  await page.goto('/edit')
  await page.getByLabel('Paste your text').fill(body)
  await page.getByRole('button', { name: 'Prepare draft' }).click()
  await page.getByRole('textbox', { name: 'name', exact: true }).fill(`__test-${Date.now()}__ Sharing`)
  await page.getByRole('textbox', { name: /handle/ }).fill(handle)
  await page.getByRole('button', { name: 'save draft', exact: true }).click()
  await expect(page).toHaveURL(/\/edit\/[^/]+$/)
  const editUrl = page.url()
  const savedBody = await page.getByRole('textbox', { name: 'Markdown', exact: true }).inputValue()
  const visitor = await browser.newContext()
  const anon = await visitor.newPage()
  try {
    await page.goto(`/p/${handle}`)
    await expect(page.getByText('Publish to share a link.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Copy/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'open raw' })).toHaveCount(0)
    await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveCount(0)
    await expectDownload(page, handle, savedBody)
    await anon.goto(`/p/${handle}`)
    await expect(anon.getByText(`cat: ${handle}.md: No such file`)).toBeVisible()
    await expect(anon.getByRole('button', { name: 'Download .md' })).toHaveCount(0)
    expect((await anon.request.get(`/${handle}.md`)).status()).toBe(404)

    await page.goto(editUrl)
    await page.getByRole('button', { name: 'publish', exact: true }).click()
    await expect(page.getByText('published · unlisted', { exact: true })).toBeVisible()
    for (const [name, style] of [['Field guide', 'field-guide'], ['Registry', 'registry'], ['Source view', 'source']]) {
      await page.getByRole('radio', { name: new RegExp(name) }).check()
      await page.getByRole('button', { name: 'save', exact: true }).click()
      await expect(page.getByRole('button', { name: 'save', exact: true })).toBeDisabled()
      await anon.setViewportSize({ width: 375, height: 812 })
      await anon.goto(`/p/${handle}?from=${style}#section`)
      await anon.reload()
      await expect(anon.locator(`[data-profile-style="${style}"]`)).toBeVisible()
      const origin = new URL(anon.url()).origin
      await visitor.grantPermissions(['clipboard-read', 'clipboard-write'])
      for (const [label, value, feedback] of [
        ['Copy profile link', `${origin}/p/${handle}`, 'Profile link copied.'],
        ['Copy Markdown link', `${origin}/${handle}.md`, 'Markdown link copied.'],
        ['Copy curl command', `curl ${origin}/${handle}.md`, 'Curl command copied.'],
      ]) {
        const button = anon.getByRole('button', { name: label, exact: true })
        await button.focus()
        await anon.keyboard.press('Enter')
        await expect(anon.getByRole('status')).toHaveText(feedback)
        expect(await anon.evaluate(() => navigator.clipboard.readText())).toBe(value)
      }
      await expectDownload(anon, handle, savedBody)
      expect(await anon.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    // Browser permission denial exercises the real Clipboard API rejection.
    const cdp = await visitor.newCDPSession(anon)
    const { targetInfo } = await cdp.send('Target.getTargetInfo')
    await cdp.send('Browser.setPermission', { browserContextId: targetInfo.browserContextId, permission: { name: 'clipboard-write', allowWithoutSanitization: true }, setting: 'denied', origin: new URL(anon.url()).origin })
    await cdp.send('Browser.setPermission', { browserContextId: targetInfo.browserContextId, permission: { name: 'clipboard-write', allowWithoutSanitization: false }, setting: 'denied', origin: new URL(anon.url()).origin })
    await anon.getByRole('button', { name: 'Copy profile link', exact: true }).click()
    await expect(anon.getByRole('status')).toHaveText("Couldn't copy profile link. Try again.")
    for (const allowWithoutSanitization of [true, false]) {
      await cdp.send('Browser.setPermission', { browserContextId: targetInfo.browserContextId, permission: { name: 'clipboard-write', allowWithoutSanitization }, setting: 'granted', origin: new URL(anon.url()).origin })
    }
    await anon.getByRole('button', { name: 'Copy profile link', exact: true }).click()
    await expect(anon.getByRole('status')).toHaveText('Profile link copied.')
    await page.getByLabel('List me in the directory').check()
    await page.getByRole('button', { name: 'save', exact: true }).click()
    await expect(page.getByText('published · listed', { exact: true })).toBeVisible()
    await anon.reload()
    await expect(anon.getByRole('button', { name: 'Copy profile link', exact: true })).toBeVisible()
    await expectDownload(anon, handle, savedBody)
    await page.getByRole('button', { name: 'unpublish', exact: true }).click()
    await expect(page.getByText('draft', { exact: true })).toBeVisible()
    await page.goto(`/p/${handle}`)
    await expect(page.getByText('Publish to share a link.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Copy/ })).toHaveCount(0)
  } finally {
    await visitor.close()
    await page.goto(editUrl)
    page.on('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'delete this file' }).click()
    await expect(page).toHaveURL(/\/edit$/)
  }
})
