import { useState } from 'react'

type Paste = { source: string; draft: string | null }
const empty: Paste = { source: '', draft: null }
const prefix = 'dot-md:paste:v1:'
// Prevent stale recovery during this session if storage becomes inaccessible.
const cleared = new Set<string>()

// Mount the caller with a userId key: account changes must never reuse form state.
export function useLocalPaste(userId: string) {
  const key = prefix + userId
  const [initial] = useState(() => {
    try {
      const raw = cleared.has(key) ? null : localStorage.getItem(key)
      if (!raw) return { paste: empty, failed: false }
      const value: unknown = JSON.parse(raw)
      if (value && typeof value === 'object' && 'source' in value && typeof value.source === 'string' &&
          'draft' in value && (value.draft === null || typeof value.draft === 'string')) {
        return { paste: { source: value.source, draft: value.draft }, failed: false }
      }
      return { paste: empty, failed: false }
    } catch {
      return { paste: empty, failed: true }
    }
  })
  const [paste, setPaste] = useState<Paste>(initial.paste)
  const [failed, setFailed] = useState(initial.failed)

  const [clearFailed, setClearFailed] = useState(false)

  function update(next: Paste) {
    setPaste(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
      cleared.delete(key)
      setClearFailed(false)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }

  function clear() {
    setPaste(empty)
    cleared.add(key)
    setClearFailed(false)
    try {
      localStorage.removeItem(key)
      setFailed(false)
    } catch {
      // A small tombstone may succeed even when removal is unavailable.
      try {
        localStorage.setItem(key, JSON.stringify(empty))
        setFailed(false)
      } catch {
        setFailed(true)
        setClearFailed(true)
        return false
      }
    }
    return true
  }

  return { ...paste, update, clear, failed, clearFailed }
}
