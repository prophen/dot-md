import { test, expect } from 'deepspace/testing'
import type { Page } from '@playwright/test'

async function create(page: Page, suffix: string) {
  await page.goto('/edit')
  await page.getByLabel('Paste your text').fill(`# __test-${suffix}`)
  await page.getByRole('button', { name: 'Prepare draft' }).click()
  await page.getByRole('textbox', { name: 'name', exact: true }).fill(`__test-${suffix}`)
  await page.getByRole('textbox', { name: /handle/ }).fill(`guard-${suffix}`)
  await page.getByRole('button', { name: 'save draft', exact: true }).click()
  await expect(page).toHaveURL(/\/edit\/[^/]+$/)
  return page.url()
}

async function warned(page: Page) {
  await page.getByRole('main').getByRole('link', { name: 'your files', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
}

test('content, style and draft listing block navigation; save resets; dirty deletion asks only once', async ({ users }) => {
  const [{ page }] = await users(1)
  const url = await create(page, Date.now().toString(36))
  const dialogs: string[] = []
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.type())
    if (dialog.type() === 'beforeunload') await dialog.dismiss()
    else await dialog.accept()
  })
  try {
    await page.getByLabel('Markdown', { exact: true }).fill('Unsaved body')
    await warned(page)
    await expect(page).toHaveURL(url)
    await expect(page.getByLabel('Markdown', { exact: true })).toHaveValue('Unsaved body')
    const unload = page.waitForEvent('dialog')
    await page.evaluate(() => window.location.reload())
    expect((await unload).type()).toBe('beforeunload')
    await expect(page.getByLabel('Markdown', { exact: true })).toHaveValue('Unsaved body')
    // Also verify listener removal independently of browser dialog policy.
    expect(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(true)
    await page.getByRole('button', { name: 'save', exact: true }).click()
    await expect(page.getByLabel('Markdown', { exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'save', exact: true })).toBeDisabled()
    await expect.poll(() => page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(false)
    await page.getByRole('main').getByRole('link', { name: 'your files', exact: true }).click()
    await expect(page).toHaveURL(/\/edit$/)
    await page.goto(url)
    await page.getByRole('radio', { name: /Field guide/ }).check()
    await warned(page)
    await expect(page.getByRole('radio', { name: /Field guide/ })).toBeChecked()
    await page.getByRole('button', { name: 'save', exact: true }).click()
    await expect(page.getByLabel('Markdown', { exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'save', exact: true })).toBeDisabled()
    await page.getByLabel('List me in the directory').check()
    await warned(page)
    await page.getByRole('button', { name: 'save', exact: true }).click()
    await expect(page.getByLabel('Markdown', { exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'save', exact: true })).toBeDisabled()
    await page.reload()
    await expect(page.getByLabel('List me in the directory')).toBeChecked()
    await page.getByRole('button', { name: 'publish', exact: true }).click()
    await expect(page.getByText('published · listed', { exact: true })).toBeVisible()
    await page.getByLabel('List me in the directory').uncheck()
    await warned(page)
    await page.getByRole('button', { name: 'delete this file' }).click()
    await expect(page).toHaveURL(/\/edit$/)
    expect(dialogs).toEqual(['beforeunload', 'confirm'])
  } finally {
    if (/\/edit\/[^/]+$/.test(page.url())) {
      await page.getByRole('button', { name: 'delete this file' }).click()
      await expect(page).toHaveURL(/\/edit$/)
    }
  }
})

test('back navigation can be canceled or accepted; another profile has its own editor state', async ({ users }) => {
  const [{ page }] = await users(1)
  const stamp = Date.now().toString(36)
  const first = await create(page, `${stamp}-a`)
  const second = await create(page, `${stamp}-b`)
  page.on('dialog', (dialog) => dialog.accept())
  try {
    await page.getByLabel('Markdown', { exact: true }).fill('Discard this edit')
    await page.goBack()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page).toHaveURL(second)
    await page.goBack()
    await page.getByRole('button', { name: 'Leave without saving', exact: true }).click()
    await expect(page).toHaveURL(/\/edit$/)
    await page.goBack()
    await expect(page).toHaveURL(first)
    await expect(page.getByLabel('Markdown', { exact: true })).toHaveValue(`# __test-${stamp}-a`)
    await expect(page.getByLabel('Markdown', { exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'save', exact: true })).toBeDisabled()
  } finally {
    for (const url of [first, second]) {
      await page.goto(url)
      await page.getByRole('button', { name: 'delete this file' }).click()
      await expect(page).toHaveURL(/\/edit$/)
    }
  }
})

test('source and review recover after refresh, stay account-scoped, discard and creation clear them', async ({ users }) => {
  const [alice, bob] = await users(2)
  const page = alice.page
  await page.goto('/edit')
  await page.getByLabel('Paste your text').fill('Private pasted source')
  await page.reload()
  await expect(page.getByLabel('Paste your text')).toHaveValue('Private pasted source')
  await page.getByRole('button', { name: 'Prepare draft' }).click()
  await page.getByLabel('Draft Markdown').fill('Private reviewed text')
  await page.reload()
  await expect(page.getByLabel('Draft Markdown')).toHaveValue('Private reviewed text')
  const stored = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('dot-md:paste:')))
  // Give Bob the same local text store, as on a shared browser, with Bob's auth.
  await bob.page.goto('/edit')
  await bob.page.evaluate((entries) => { for (const [key, value] of entries) localStorage.setItem(key, value) }, stored)
  await bob.page.reload()
  await expect(bob.page.getByLabel('Paste your text')).toHaveValue('')
  await bob.page.getByLabel('Paste your text').fill('Bob only')
  await bob.page.reload()
  await expect(bob.page.getByLabel('Paste your text')).toHaveValue('Bob only')
  await page.reload()
  await expect(page.getByLabel('Draft Markdown')).toHaveValue('Private reviewed text')
  await page.getByRole('button', { name: 'Discard local text' }).click()
  await page.reload()
  await expect(page.getByLabel('Paste your text')).toHaveValue('')
  await create(page, Date.now().toString(36))
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'delete this file' }).click()
  await expect(page).toHaveURL(/\/edit$/)
  await page.reload()
  await expect(page.getByLabel('Paste your text')).toHaveValue('')
  await bob.page.getByRole('button', { name: 'Discard local text' }).click()
})

for (const failure of ['unavailable', 'quota']) {
  test(`${failure} storage keeps paste editing and creation working`, async ({ users }) => {
    const [{ page }] = await users(1)
    await page.addInitScript((kind) => {
      const fail = () => { throw new DOMException('Storage unavailable', kind === 'quota' ? 'QuotaExceededError' : 'SecurityError') }
      // Fail recovery storage without interfering with the SDK's auth storage.
      const get = Storage.prototype.getItem
      const set = Storage.prototype.setItem
      const remove = Storage.prototype.removeItem
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('dot-md:paste:')) fail()
        return set.call(this, key, value)
      }
      if (kind === 'unavailable') {
        Storage.prototype.getItem = function (key) {
          if (key.startsWith('dot-md:paste:')) fail()
          return get.call(this, key)
        }
        Storage.prototype.removeItem = function (key) {
          if (key.startsWith('dot-md:paste:')) fail()
          return remove.call(this, key)
        }
      }
    }, failure)
    await page.goto('/edit')
    await page.getByLabel('Paste your text').fill('Still editable')
    await expect(page.getByRole('alert')).toContainText('Local recovery is unavailable')
    await page.getByRole('button', { name: 'Prepare draft' }).click()
    await page.getByLabel('Draft Markdown').fill('Reviewed without storage')
    await page.getByRole('button', { name: 'Discard local text' }).click()
    await expect(page.getByLabel('Paste your text')).toHaveValue('')
    await create(page, `${Date.now().toString(36)}-${failure}`)
    await expect(page.getByLabel('Markdown', { exact: true })).toBeVisible()
    page.on('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'delete this file' }).click()
    await expect(page).toHaveURL(/\/edit$/)
  })
}
