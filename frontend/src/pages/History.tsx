import { useState, useEffect } from 'react'
import { transactionsApi } from '../api/transactions'
import type { Transaction } from '../types'
import { TrendingUp, TrendingDown, ArrowRightLeft, Loader2, Search, Download } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency, formatDate } from '../utils/format'
import { getTxConfig } from '../utils/transactions'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

type FilterType = 'all' | 'deposit' | 'withdrawal' | 'transfer'

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'Todos',
  deposit: 'Depósitos',
  withdrawal: 'Retiros',
  transfer: 'Transferencias',
}

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    transactionsApi.history(100)
      .then(setTransactions)
      .finally(() => setLoading(false))
  }, [])

  async function downloadCSV() {
    setExporting(true)
    try {
      await transactionsApi.exportCSV()
    } finally {
      setExporting(false)
    }
  }

  const filtered = transactions.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        t.from_account.toLowerCase().includes(s) ||
        t.to_account.toLowerCase().includes(s) ||
        (t.description || '').toLowerCase().includes(s) ||
        t.type.toLowerCase().includes(s)
      )
    }
    return true
  })

  const stats = {
    deposits:    transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0),
    withdrawals: transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0),
    transfers:   transactions.filter(t => t.type === 'transfer').length,
  }

  const ExportButton = (
    <button
      onClick={downloadCSV}
      disabled={exporting || loading}
      className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      {exporting ? 'Exportando...' : 'Exportar CSV'}
    </button>
  )

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Historial de Transacciones"
        subtitle="Todos tus movimientos bancarios"
        action={ExportButton}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Depósitos"
          value={formatCurrency(stats.deposits)}
          Icon={TrendingUp}
          iconClass="text-emerald-600"
          iconBgClass="bg-emerald-50"
        />
        <StatCard
          title="Total Retiros"
          value={formatCurrency(stats.withdrawals)}
          Icon={TrendingDown}
          iconClass="text-red-500"
          iconBgClass="bg-red-50"
        />
        <StatCard
          title="Transferencias"
          value={String(stats.transfers)}
          Icon={ArrowRightLeft}
          iconClass="text-violet-600"
          iconBgClass="bg-violet-50"
        />
      </div>

      {/* Transaction type distribution chart */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Distribución por Tipo</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Depósitos', value: stats.deposits, color: '#10b981' },
                    { name: 'Retiros', value: stats.withdrawals, color: '#ef4444' },
                    { name: 'Transferencias', value: stats.transfers || 0.01, color: '#3b82f6' },
                  ].filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={72}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {[
                    { name: 'Depósitos', value: stats.deposits, color: '#10b981' },
                    { name: 'Retiros', value: stats.withdrawals, color: '#ef4444' },
                    { name: 'Transferencias', value: stats.transfers || 0.01, color: '#3b82f6' },
                  ].filter(d => d.value > 0).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, name: string) => [name === 'Transferencias' ? v : formatCurrency(v), name]}
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Depósitos</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Retiros</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Transferencias</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col items-center justify-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Movido</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{formatCurrency(stats.deposits + stats.withdrawals)}</p>
            <p className="text-xs text-slate-400 mt-1">{transactions.length} transacciones totales</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar transacciones..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(FILTER_LABELS) as FilterType[]).map(f => {
              const isActive = filter === f
              let activeCls = 'bg-slate-800 text-white'
              if (isActive && f !== 'all') {
                const tc = getTxConfig(f)
                activeCls = `${tc.bgColor} ${tc.color}`
              }
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive ? activeCls : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 size={28} className="animate-spin text-violet-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12">
            <EmptyState
              Icon={Search}
              message="No se encontraron transacciones"
              description="Intenta cambiar los filtros o el término de búsqueda"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Origen</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Destino</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((txn, i) => {
                  const cfg = getTxConfig(txn.type)
                  return (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <Badge type={txn.type} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{txn.from_account}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{txn.to_account}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${cfg.color}`}>
                        {cfg.sign}{formatCurrency(txn.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(txn.timestamp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
