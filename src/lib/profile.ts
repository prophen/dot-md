/** "now", "5m", "3d", "2w", "4mo", "1y" — ls-style ages for the directory. */
export function age(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)}m`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)}h`
  const d = h / 24
  if (d < 14) return `${Math.floor(d)}d`
  if (d < 60) return `${Math.floor(d / 7)}w`
  if (d < 365) return `${Math.floor(d / 30)}mo`
  return `${Math.floor(d / 365)}y`
}

export function rawPath(handle: string): string {
  return `/${handle}.md`
}

/** Today as YYYY-MM-DD in the writer's own timezone, not UTC. */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Bump a `Last updated: YYYY-MM-DD` stamp, if the file has one, so the date
 *  agents are told to check stays true. */
export function touchLastUpdated(body: string, date = localDate()): string {
  return body.replace(/(Last updated:\s*)\d{4}-\d{2}-\d{2}/, `$1${date}`)
}
