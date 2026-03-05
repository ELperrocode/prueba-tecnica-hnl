import { describe, it, expect } from 'vitest'
import { getTxConfig, TRANSACTION_CONFIG } from '../../utils/transactions'

describe('getTxConfig', () => {
  it('returns correct config for deposit', () => {
    const config = getTxConfig('deposit')
    expect(config.label).toBe('Depósito')
    expect(config.sign).toBe('+')
    expect(config.color).toBe('text-emerald-600')
  })

  it('returns correct config for withdrawal', () => {
    const config = getTxConfig('withdrawal')
    expect(config.label).toBe('Retiro')
    expect(config.sign).toBe('-')
    expect(config.color).toBe('text-red-500')
  })

  it('returns correct config for transfer', () => {
    const config = getTxConfig('transfer')
    expect(config.label).toBe('Transferencia')
    expect(config.sign).toBe('±')
    expect(config.bgColor).toBe('bg-blue-50')
  })

  it('falls back to transfer for unknown types', () => {
    const config = getTxConfig('unknown-type')
    expect(config).toEqual(TRANSACTION_CONFIG.transfer)
  })
})
