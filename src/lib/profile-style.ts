export const PROFILE_STYLES = ['source', 'field-guide', 'registry'] as const
export type ProfileStyle = typeof PROFILE_STYLES[number]
export const PROFILE_STYLE_OPTIONS: { id: ProfileStyle; name: string; description: string }[] = [
  { id: 'source', name: 'Source view', description: 'Paper, rust syntax, and numbered lines.' },
  { id: 'field-guide', name: 'Field guide', description: 'Warm parchment, forest ink, and editorial type.' },
  { id: 'registry', name: 'Registry', description: 'Black and yellow, bold type, and strong rules.' },
]

/** Older profiles and unknown values retain the original presentation. */
export function profileStyle(value: unknown): ProfileStyle {
  return PROFILE_STYLES.includes(value as ProfileStyle) ? value as ProfileStyle : 'source'
}
