import { describe, expect, it } from 'vitest'
import { resolveRange, shiftAnchor } from './ranges'
import { parseDateOnly } from './week'

describe('resolveRange', () => {
  it('"all" has no bounds', () => {
    const range = resolveRange({ type: 'all', anchor: parseDateOnly('2026-07-20') })
    expect(range.startMs).toBeNull()
    expect(range.endMs).toBeNull()
  })

  it('"week" resolves to the custom Saturday-Friday week containing the anchor', () => {
    const range = resolveRange({ type: 'week', anchor: parseDateOnly('2026-07-22') }) // Wednesday
    expect(range.startMs).toBe(parseDateOnly('2026-07-18').getTime())
  })

  it('"month" resolves to the calendar month', () => {
    const range = resolveRange({ type: 'month', anchor: parseDateOnly('2026-07-15') })
    expect(new Date(range.startMs as number).getMonth()).toBe(6) // July (0-indexed)
    expect(new Date(range.startMs as number).getDate()).toBe(1)
    expect(new Date(range.endMs as number).getMonth()).toBe(6)
  })

  it('"quarter" resolves Jul-Sep to Q3', () => {
    const range = resolveRange({ type: 'quarter', anchor: parseDateOnly('2026-08-15') })
    expect(range.label).toBe('Q3 2026')
    expect(new Date(range.startMs as number).getMonth()).toBe(6) // July
    expect(new Date(range.endMs as number).getMonth()).toBe(8) // September
  })

  it('"half" resolves Jul-Dec to H2', () => {
    const range = resolveRange({ type: 'half', anchor: parseDateOnly('2026-11-01') })
    expect(range.label).toBe('H2 2026')
    expect(new Date(range.startMs as number).getMonth()).toBe(6)
  })

  it('"half" resolves Jan-Jun to H1', () => {
    const range = resolveRange({ type: 'half', anchor: parseDateOnly('2026-03-01') })
    expect(range.label).toBe('H1 2026')
  })

  it('"year" resolves to the full calendar year', () => {
    const range = resolveRange({ type: 'year', anchor: parseDateOnly('2026-06-01') })
    expect(range.label).toBe('2026')
    expect(new Date(range.startMs as number).getFullYear()).toBe(2026)
    expect(new Date(range.startMs as number).getMonth()).toBe(0)
    expect(new Date(range.endMs as number).getMonth()).toBe(11)
  })
})

describe('shiftAnchor', () => {
  it('moves the week anchor by exactly 7 days', () => {
    const anchor = parseDateOnly('2026-07-18')
    const next = shiftAnchor({ type: 'week', anchor }, 1)
    expect(next.getTime() - anchor.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('moves the month anchor by one calendar month', () => {
    const anchor = parseDateOnly('2026-07-15')
    const next = shiftAnchor({ type: 'month', anchor }, 1)
    expect(next.getMonth()).toBe(7) // August
  })

  it('moves the quarter anchor by 3 months', () => {
    const anchor = parseDateOnly('2026-01-15')
    const next = shiftAnchor({ type: 'quarter', anchor }, 1)
    expect(next.getMonth()).toBe(3) // April
  })

  it('moves the year anchor by one year', () => {
    const anchor = parseDateOnly('2026-06-01')
    const next = shiftAnchor({ type: 'year', anchor }, 1)
    expect(next.getFullYear()).toBe(2027)
  })

  it('is a no-op for "all"', () => {
    const anchor = parseDateOnly('2026-06-01')
    const next = shiftAnchor({ type: 'all', anchor }, 1)
    expect(next).toBe(anchor)
  })
})
