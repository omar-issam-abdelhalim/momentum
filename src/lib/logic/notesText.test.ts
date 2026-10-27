import { describe, expect, it } from 'vitest'
import { noteHasLinks, noteTextPreview, parseNoteText } from './notesText'

describe('parseNoteText', () => {
  it('returns plain text unchanged as a single segment', () => {
    expect(parseNoteText('Read chapter 1')).toEqual([{ type: 'text', text: 'Read chapter 1' }])
  })

  it('returns no segments for empty text', () => {
    expect(parseNoteText('')).toEqual([])
  })

  it('turns a markdown link into a link labelled with its text', () => {
    expect(parseNoteText('See [uv docs](https://docs.astral.sh/uv/) now')).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', text: 'uv docs', href: 'https://docs.astral.sh/uv/' },
      { type: 'text', text: ' now' },
    ])
  })

  it('turns a bare URL into a link and leaves trailing punctuation outside it', () => {
    expect(parseNoteText('Open https://example.com/a?b=1, then continue.')).toEqual([
      { type: 'text', text: 'Open ' },
      { type: 'link', text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { type: 'text', text: ', then continue.' },
    ])
  })

  it('keeps URL fragments and query strings intact', () => {
    const url = 'https://mail.google.com/mail/?authuser=s-x@y.eg#all/thread-f:1879651833849949833'
    expect(parseNoteText(url)).toEqual([{ type: 'link', text: url, href: url }])
  })

  it('handles several links across lines, mixing both forms', () => {
    const segments = parseNoteText('Links:\n- [A](https://a.dev)\n- https://b.dev/x\n')
    expect(segments.filter((s) => s.type === 'link')).toEqual([
      { type: 'link', text: 'A', href: 'https://a.dev' },
      { type: 'link', text: 'https://b.dev/x', href: 'https://b.dev/x' },
    ])
    expect(segments.map((s) => s.text).join('')).toBe('Links:\n- A\n- https://b.dev/x\n')
  })

  it('never produces a link for non-http schemes', () => {
    expect(noteHasLinks('[click](javascript:alert(1)) data:text/html,hi mailto:a@b.c')).toBe(false)
  })

  it('keeps Arabic text around links', () => {
    expect(parseNoteText('افتح https://moodle.example.edu/x، وبعدين')).toEqual([
      { type: 'text', text: 'افتح ' },
      { type: 'link', text: 'https://moodle.example.edu/x', href: 'https://moodle.example.edu/x' },
      { type: 'text', text: '، وبعدين' },
    ])
  })
})

describe('noteTextPreview', () => {
  it('shows markdown links as their labels on one line', () => {
    expect(noteTextPreview('Goal.\n\nLinks:\n- [Pro Git](https://git-scm.com/book)')).toBe('Goal. Links: - Pro Git')
  })
})
