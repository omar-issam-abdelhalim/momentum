import { describe, expect, it } from 'vitest'
import { clampCount, effectiveTarget, isCounterTarget, progressPercent } from './quantity'

describe('effectiveTarget', () => {
  it('treats undefined, 0, and 1 as the binary target of 1', () => {
    expect(effectiveTarget(undefined)).toBe(1)
    expect(effectiveTarget(0)).toBe(1)
    expect(effectiveTarget(1)).toBe(1)
  })

  it('floors fractional targets above 1', () => {
    expect(effectiveTarget(5.9)).toBe(5)
  })

  it('passes through a real integer target', () => {
    expect(effectiveTarget(5)).toBe(5)
  })
})

describe('isCounterTarget', () => {
  it('is false for binary targets, true for targets > 1', () => {
    expect(isCounterTarget(undefined)).toBe(false)
    expect(isCounterTarget(1)).toBe(false)
    expect(isCounterTarget(2)).toBe(true)
  })
})

describe('clampCount', () => {
  it('floors at 0', () => {
    expect(clampCount(-3, 5)).toBe(0)
  })

  it('caps at target (overshoot beyond target is a no-op)', () => {
    expect(clampCount(9, 5)).toBe(5)
  })

  it('passes through an in-range count unchanged', () => {
    expect(clampCount(3, 5)).toBe(3)
  })
})

describe('progressPercent', () => {
  it('computes a rounded percentage', () => {
    expect(progressPercent(1, 3)).toBe(33)
    expect(progressPercent(2, 3)).toBe(67)
  })

  it('caps the displayed percentage at 100 even if count exceeds target', () => {
    expect(progressPercent(9, 5)).toBe(100)
  })

  it('never divides by zero', () => {
    expect(progressPercent(3, 0)).toBe(0)
  })
})
