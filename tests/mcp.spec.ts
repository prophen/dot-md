import { test, expect } from 'deepspace/testing'
import type { APIRequestContext, Page } from '@playwright/test'

/**
 * The MCP endpoint end to end: mint a token on "your files", then drive
 * /agent/mcp as an MCP client would — and check that a token only ever
 * reaches its own person's files, and stops working once revoked.
 */

type Rpc = (method: string, params?: Record<string, unknown>) => Promise<{ status: number; body: any }>

function client(request: APIRequestContext, token: string | null): Rpc {
  let id = 0
  return async (method, params) => {
    const res = await request.post('/agent/mcp', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      data: { jsonrpc: '2.0', id: ++id, method, ...(params ? { params } : {}) },
    })
    return { status: res.status(), body: await res.json() }
  }
}

async function mintToken(page: Page, name: string): Promise<string> {
  await page.goto('/edit')
  await page.getByPlaceholder('Claude Code on laptop').fill(name)
  await page.getByRole('button', { name: 'create token' }).click()
  const token = (await page.getByTestId('new-token').textContent())?.trim() ?? ''
  expect(token).toMatch(/^dmd_[\w-]{40,}$/)
  if (process.env.PROFILE_SHOTS_DIR) await page.screenshot({ path: `${process.env.PROFILE_SHOTS_DIR}/5-token-${name.replace(/\W+/g, '-')}.png`, fullPage: true })
  await page.getByRole('button', { name: 'done' }).click()
  return token
}

const call = (rpc: Rpc, name: string, args: Record<string, unknown>) => rpc('tools/call', { name, arguments: args })

test('MCP: create, update and publish a file with a personal access token', async ({ users, browser }) => {
  const [alice, bob] = await users(2)
  const handle = `mcp-${Date.now().toString(36)}`
  const api = (await browser.newContext()).request

  // No token, or a made-up one: 401 with a pointer to where tokens come from.
  expect((await client(api, null)('tools/list')).status).toBe(401)
  expect((await client(api, 'dmd_not-a-real-token')('tools/list')).status).toBe(401)

  const aliceToken = await mintToken(alice.page, 'e2e alice')
  const rpc = client(api, aliceToken)

  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } })
  expect(init.body.result.capabilities.tools).toBeDefined()

  const list = await rpc('tools/list')
  const names = list.body.result.tools.map((t: { name: string }) => t.name)
  expect(names).toEqual(
    expect.arrayContaining(['list_starters', 'list_my_files', 'read_file', 'create_file', 'update_file', 'publish_file', 'unpublish_file']),
  )
  expect(names).not.toContain('records_delete')

  const created = await call(rpc, 'create_file', { handle, name: 'Mcp Designer', starter: 'designer' })
  expect(created.body.result.isError).toBe(false)
  expect(created.body.result.structuredContent.status).toBe('draft')

  const read = await call(rpc, 'read_file', { handle })
  const markdown: string = read.body.result.structuredContent.markdown
  expect(markdown).toContain('## Case studies')

  const updated = await call(rpc, 'update_file', {
    handle,
    markdown: markdown.replace(/^> .*$/m, '> Product designer who writes the spec before the mockup.'),
  })
  expect(updated.body.result.structuredContent.summary).toBe('Product designer who writes the spec before the mockup.')

  // Bob's token can't see or change Alice's file, or take her handle.
  const bobToken = await mintToken(bob.page, 'e2e bob')
  const bobRpc = client(api, bobToken)
  const peek = await call(bobRpc, 'read_file', { handle })
  expect(peek.body.result.isError).toBe(true)
  expect(peek.body.result.structuredContent ?? JSON.parse(peek.body.result.content[0].text)).toMatchObject({ code: 'not_found' })
  expect((await call(bobRpc, 'update_file', { handle, markdown: '# Mine now' })).body.result.isError).toBe(true)
  expect((await call(bobRpc, 'publish_file', { handle })).body.result.isError).toBe(true)
  const squat = await call(bobRpc, 'create_file', { handle, name: 'Bob' })
  expect(JSON.parse(squat.body.result.content[0].text)).toMatchObject({ code: 'handle_taken' })

  const discover = async (expected: boolean) => {
    for (const caller of [rpc, bobRpc]) {
      const found = await call(caller, 'search_profiles', { query: handle })
      expect(found.body.result.isError).toBe(false)
      expect(found.body.result.structuredContent.results.map((r: { handle: string }) => r.handle)).toEqual(expected ? [handle] : [])
    }
    const found = await api.get(`/api/public/search?query=${handle}`)
    expect(found.status()).toBe(200)
    expect(found.headers()['cache-control']).toBe('no-store')
    const results = (await found.json()).results
    expect(results.map((r: { handle: string }) => r.handle)).toEqual(expected ? [handle] : [])
    if (expected) {
      expect(results[0].page).toContain(`/p/${handle}`)
      expect(results[0].raw).toContain(`/${handle}.md`)
      expect(results[0].evidence[0].excerpt).toContain(handle)
    }
  }
  await discover(false) // owner's draft must not appear
  const published = await call(rpc, 'publish_file', { handle })
  expect(published.body.result.structuredContent).toMatchObject({ status: 'published', listed: false })
  await discover(false) // public by exact URL is still not discoverable
  const listed = await call(rpc, 'publish_file', { handle, listed: true })
  expect(listed.body.result.structuredContent.listed).toBe(true)
  await discover(true)
  expect((await call(rpc, 'publish_file', { handle })).body.result.structuredContent.listed).toBe(true)
  const unlisted = await call(rpc, 'publish_file', { handle, listed: false })
  expect(unlisted.body.result.structuredContent).toMatchObject({ status: 'published', listed: false })
  await discover(false)
  expect((await call(bobRpc, 'read_file', { handle })).body.result.isError).toBe(true)
  expect((await call(bobRpc, 'publish_file', { handle, listed: true })).body.result.isError).toBe(true)
  await call(rpc, 'unpublish_file', { handle })
  await discover(false)
  expect((await api.get(`/api/public/profiles/${handle}`)).status()).toBe(404)
  expect((await call(rpc, 'publish_file', { handle })).body.result.structuredContent.listed).toBe(false)
  const beforeStyle = (await call(rpc, 'read_file', { handle })).body.result.structuredContent
  expect((await call(bobRpc, 'set_profile_style', { handle, style: 'registry' })).body.result.isError).toBe(true)
  expect((await call(rpc, 'set_profile_style', { handle, style: 'unknown' })).body.result.isError).toBe(true)
  const styled = await call(rpc, 'set_profile_style', { handle, style: 'registry' })
  expect(styled.body.result.structuredContent).toMatchObject({ style: 'registry', status: 'published', listed: false })
  expect((await call(rpc, 'read_file', { handle })).body.result.structuredContent.markdown).toBe(beforeStyle.markdown)
  const raw = await api.get(`/${handle}.md`)
  expect(raw.status()).toBe(200)
  expect(await raw.text()).toContain('> Product designer who writes the spec before the mockup.')

  const mine = await call(rpc, 'list_my_files', {})
  expect(mine.body.result.structuredContent.files.map((f: { handle: string }) => f.handle)).toContain(handle)

  // Revoking a token cuts it off immediately.
  alice.page.on('dialog', (d) => d.accept())
  await alice.page.goto('/edit')
  await alice.page.getByRole('listitem').filter({ hasText: 'e2e alice' }).getByRole('button', { name: 'revoke' }).click()
  await expect(alice.page.getByText('e2e alice')).toHaveCount(0)
  expect((await rpc('tools/list')).status).toBe(401)

  // Clean up: Alice deletes the file in the editor (there's no delete tool), Bob revokes his token.
  await alice.page.getByRole('link', { name: new RegExp(`${handle}\\.md`) }).click()
  await alice.page.getByRole('button', { name: 'delete this file' }).click()
  await expect(alice.page).toHaveURL(/\/edit$/)
  bob.page.on('dialog', (d) => d.accept())
  await bob.page.goto('/edit')
  await bob.page.getByRole('listitem').filter({ hasText: 'e2e bob' }).getByRole('button', { name: 'revoke' }).click()
  await expect(bob.page.getByText('e2e bob')).toHaveCount(0)
})
