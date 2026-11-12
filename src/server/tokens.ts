/** Personal access tokens: `dmd_` + 32 random bytes, base64url. Only the
 *  SHA-256 hex digest is stored. */

export const TOKEN_PREFIX = 'dmd_'

export function mintToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${TOKEN_PREFIX}${b64}`
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
