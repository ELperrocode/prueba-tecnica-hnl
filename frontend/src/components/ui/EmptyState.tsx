import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  Icon: LucideIcon
  message: string
  description?: string
}

export default function EmptyState({ Icon, message, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon size={24} className="text-slate-400" />
      </div>
      <p className="text-slate-700 font-medium">{message}</p>
      {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
    </div>
  )
}
