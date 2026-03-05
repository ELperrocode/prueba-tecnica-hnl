import { useState, useEffect } from 'react'
import { transactionsApi } from '../api/transactions'
import type { Transaction } from '../types'
import { TrendingUp, TrendingDown, ArrowRightLeft, Loader2, Search, Download } from 'lucide-react'
import Chat from '../components/Chat'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; sign: string }> = {
  deposit: {
    label: 'Depósito',
    color: 'text-emerald-600',
    icon: <TrendingUp size={16} className="text-emerald-600" />,
    sign: '+',
  },
  withdrawal: {
    label: 'Retiro',
    color: 'text-red-500',
    icon: <TrendingDown size={16} className="text-red-500" />,
    sign: '-',
  },
  transfer: {
    label: 'Transferencia',
    color: 'text-blue-600',
    icon: <ArrowRightLeft size={16} className="text-blue-600" />,
    sign: '±',
  },
}

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'transfer'>('all')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    transactionsApi.history(100)
      .then(setTransactions)
      .finally(() => setLoading(false))
  }, [])

  async function downloadCSV() {
    setExporting(true)
    try {
      const token = localStorage.getItem('token')
      const base = import.meta.env.VITE_API_URL || '/api'
      const res = await fetch(`${base}/transactions/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `historial-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
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
    deposits: transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0),
    withdrawals: transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0),
    transfers: transactions.filter(t => t.type === 'transfer').length,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Transacciones</h1>
          <p className="text-gray-500 text-sm mt-1">Todos tus movimientos bancarios</p>
        </div>
        <button
          onClick={downloadCSV}
          disabled={exporting || loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Depósitos</p>
          <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.deposits)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Retiros</p>
          <p className="text-lg font-bold text-red-500">{formatCurrency(stats.withdrawals)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Transferencias</p>
          <p className="text-lg font-bold text-blue-600">{stats.transfers}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar transacciones..."
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'deposit', 'withdrawal', 'transfer'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  filter === f ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'deposit' ? 'Depósitos' : f === 'withdrawal' ? 'Retiros' : 'Transferencias'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 size={24} className="animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-12">
            <p className="text-gray-400 text-sm">No se encontraron transacciones</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Origen</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Destino</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Monto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((txn, i) => {
                  const cfg = TYPE_CONFIG[txn.type] || TYPE_CONFIG.transfer
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {cfg.icon}
                          <span className="text-gray-700 font-medium">{cfg.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{txn.from_account}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{txn.to_account}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${cfg.color}`}>
                        {cfg.sign}{formatCurrency(txn.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(txn.timestamp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Chat />
    </div>
  )
}
