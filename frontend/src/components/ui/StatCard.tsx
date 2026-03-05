import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  Icon: LucideIcon
  iconClass?: string
  iconBgClass?: string
  trend?: { label: string; positive: boolean }
}

export default function StatCard({ title, value, Icon, iconClass = 'text-violet-600', iconBgClass = 'bg-violet-50', trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', iconBgClass)}>
        <Icon size={20} className={iconClass} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{title}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
        {trend && (
          <p className={clsx('text-xs mt-0.5', trend.positive ? 'text-emerald-600' : 'text-red-500')}>
            {trend.positive ? '↑' : '↓'} {trend.label}
          </p>
        )}
      </div>
    </div>
  )
}
