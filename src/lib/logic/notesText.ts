/**
 * Turns a goal's free-text notes into renderable segments so links can be
 * tapped. Two link forms are recognised:
 *   - Markdown links: `[label](https://example.com)` — rendered as `label`.
 *   - Bare URLs:      `https://example.com/page`     — rendered as the URL.
 * Only http(s) URLs ever become links; anything else (javascript:, data:,
 * mailto:, …) stays plain text, so notes can never produce an unsafe href.
 * Pure and side-effect free — see notesText.test.ts.
 */

export type NoteSegment = { type: 'text'; text: string } | { type: 'link'; text: string; href: string }

// [label](http(s)://...)  — label may not contain brackets; URL may not contain whitespace or ')'.
const MARKDOWN_LINK = /\[([^[\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g
const BARE_URL = /https?:\/\/[^\s<>"]+/g
// Punctuation that usually ends a sentence rather than belonging to the URL.
const TRAILING_PUNCTUATION = /[.,;:!?'")\]،]+$/

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function pushText(out: NoteSegment[], text: string) {
  if (!text) return
  const last = out[out.length - 1]
  if (last && last.type === 'text') last.text += text
  else out.push({ type: 'text', text })
}

function splitBareUrls(text: string, out: NoteSegment[]) {
  let cursor = 0
  for (const match of text.matchAll(BARE_URL)) {
    const start = match.index ?? 0
    let url = match[0]
    const trailing = url.match(TRAILING_PUNCTUATION)?.[0] ?? ''
    if (trailing) url = url.slice(0, url.length - trailing.length)
    pushText(out, text.slice(cursor, start))
    if (isHttpUrl(url)) out.push({ type: 'link', text: url, href: url })
    else pushText(out, url)
    cursor = start + url.length
  }
  pushText(out, text.slice(cursor))
}

export function parseNoteText(text: string): NoteSegment[] {
  const out: NoteSegment[] = []
  let cursor = 0
  for (const match of text.matchAll(MARKDOWN_LINK)) {
    const start = match.index ?? 0
    const [whole, label, href] = match
    splitBareUrls(text.slice(cursor, start), out)
    if (isHttpUrl(href)) out.push({ type: 'link', text: label, href })
    else pushText(out, whole)
    cursor = start + whole.length
  }
  splitBareUrls(text.slice(cursor), out)
  return out
}

/** One-line preview for the collapsed card: markdown links shown as their labels. */
export function noteTextPreview(text: string): string {
  return parseNoteText(text)
    .map((s) => s.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

export function noteHasLinks(text: string): boolean {
  return parseNoteText(text).some((s) => s.type === 'link')
}
