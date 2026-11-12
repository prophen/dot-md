/** Keep supplied facts and Markdown intact; never infer profile fields. */
export const PASTE_LIMIT = 20_000

export function preparePastedDraft(source: string): string {
  if (!source.trim()) throw new Error('Paste some resume text, a bio, or Markdown to continue.')
  if (source.length > PASTE_LIMIT) {
    throw new Error('Use 20,000 characters or fewer. Shorten the text and try again; nothing has been truncated.')
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(source)) {
    throw new Error('This contains unsupported control characters. Copy plain text from your document and try again.')
  }
  return source.replace(/\r\n?/g, '\n')
}
