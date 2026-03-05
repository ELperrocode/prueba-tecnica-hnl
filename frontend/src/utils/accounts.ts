export interface AccountConfig {
  label: string
  /** Static Tailwind text-color class (must be a complete literal string for purging). */
  textColor: string
  /** Static Tailwind bg-color class (light tint). */
  bgColor: string
  /** Static Tailwind border-color class. */
  borderColor: string
  /** Gradient for the hero card. */
  gradient: string
}

export const ACCOUNT_CONFIG: Record<string, AccountConfig> = {
  checking: {
    label: 'Cuenta Corriente',
    textColor: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    gradient: 'from-violet-600 to-violet-700',
  },
  savings: {
    label: 'Cuenta de Ahorro',
    textColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    gradient: 'from-emerald-600 to-emerald-700',
  },
  investment: {
    label: 'Cuenta de Inversión',
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    gradient: 'from-amber-600 to-amber-700',
  },
}

export function getAccountConfig(type: string): AccountConfig {
  return ACCOUNT_CONFIG[type] ?? ACCOUNT_CONFIG.checking
}
