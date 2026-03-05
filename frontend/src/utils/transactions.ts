import { TrendingUp, TrendingDown, ArrowRightLeft, type LucideIcon } from 'lucide-react'

export interface TxConfig {
  label: string
  sign: string
  color: string          // text-* class
  bgColor: string        // bg-*/10 class for badge bg
  borderColor: string    // border-* class
  Icon: LucideIcon
}

export const TRANSACTION_CONFIG: Record<string, TxConfig> = {
  deposit: {
    label: 'Depósito',
    sign: '+',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    Icon: TrendingUp,
  },
  withdrawal: {
    label: 'Retiro',
    sign: '-',
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    Icon: TrendingDown,
  },
  transfer: {
    label: 'Transferencia',
    sign: '±',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    Icon: ArrowRightLeft,
  },
}

export function getTxConfig(type: string): TxConfig {
  return TRANSACTION_CONFIG[type] ?? TRANSACTION_CONFIG.transfer
}
