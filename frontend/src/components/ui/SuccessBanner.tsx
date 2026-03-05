import { CheckCircle } from 'lucide-react'

interface SuccessBannerProps {
  message: string
}

export default function SuccessBanner({ message }: SuccessBannerProps) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
      <CheckCircle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
