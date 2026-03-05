import { clsx } from 'clsx'
import { getTxConfig } from '../../utils/transactions'

interface BadgeProps {
  type: string
  size?: 'sm' | 'md'
}

export default function Badge({ type, size = 'sm' }: BadgeProps) {
  const cfg = getTxConfig(type)
  const { Icon } = cfg
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full font-medium border',
      cfg.bgColor, cfg.color, cfg.borderColor,
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
    )}>
      <Icon size={size === 'sm' ? 11 : 13} />
      {cfg.label}
    </span>
  )
}
