import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate } from './format'

describe('formatCurrency', () => {
  it('formats positive numbers as USD', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00')
  })

  it('formats decimals correctly', () => {
    expect(formatCurrency(99.5)).toBe('$99.50')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats negative numbers', () => {
    expect(formatCurrency(-250)).toBe('-$250.00')
  })
})

describe('formatDate', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDate('2024-01-15T10:30:00Z')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('includes the year in the output', () => {
    const result = formatDate('2024-06-01T00:00:00Z')
    expect(result).toContain('2024')
  })
})
