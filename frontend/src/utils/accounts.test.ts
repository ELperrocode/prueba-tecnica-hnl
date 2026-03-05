import { describe, it, expect } from 'vitest'
import { getAccountConfig, ACCOUNT_CONFIG } from './accounts'

describe('getAccountConfig', () => {
  it('returns correct config for checking', () => {
    const config = getAccountConfig('checking')
    expect(config.label).toBe('Cuenta Corriente')
    expect(config.textColor).toBe('text-violet-600')
  })

  it('returns correct config for savings', () => {
    const config = getAccountConfig('savings')
    expect(config.label).toBe('Cuenta de Ahorro')
    expect(config.gradient).toBe('from-emerald-600 to-emerald-700')
  })

  it('returns correct config for investment', () => {
    const config = getAccountConfig('investment')
    expect(config.label).toBe('Cuenta de Inversión')
    expect(config.bgColor).toBe('bg-amber-50')
  })

  it('falls back to checking for unknown types', () => {
    const config = getAccountConfig('unknown-type')
    expect(config).toEqual(ACCOUNT_CONFIG.checking)
  })
})
