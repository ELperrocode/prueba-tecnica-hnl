import { useEffect, useState } from 'react'
import { accountsApi } from '../api/accounts'
import { transactionsApi } from '../api/transactions'
import { useAuth } from '../contexts/AuthContext'
import type { Account, Transaction } from '../types'
import Chat from '../components/Chat'
import { TrendingUp, TrendingDown, ArrowRightLeft, CreditCard, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const ACCOUNT_COLORS: Record<string, string> = {
  checking: 'bg-blue-500',
  savings: 'bg-emerald-500',
  investment: 'bg-purple-500',
}

const ACCOUNT_LABELS: Record<string, string> = {
  checking: 'Cuenta Corriente',
  savings: 'Cuenta de Ahorros',
  investment: 'Cuenta de Inversión',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('es-HN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      accountsApi.list(),
      transactionsApi.history(20),
    ]).then(([accts, txns]) => {
      setAccounts(accts)
      setTransactions(txns)
    }).finally(() => setLoading(false))
  }, [])

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  const chartData = accounts.map(a => ({
    name: ACCOUNT_LABELS[a.account_type] || a.account_type,
    balance: a.balance,
  }))

  const txTypeIcon = (type: string) => {
    if (type === 'deposit') return <TrendingUp size={16} className="text-emerald-600" />
    if (type === 'withdrawal') return <TrendingDown size={16} className="text-red-500" />
    return <ArrowRightLeft size={16} className="text-blue-500" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {user?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Aquí tienes un resumen de tus cuentas</p>
      </div>

      {/* Total Balance */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white mb-6">
        <p className="text-blue-200 text-sm font-medium">Balance Total</p>
        <p className="text-4xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
        <p className="text-blue-200 text-sm mt-2">{accounts.length} cuenta(s) activa(s)</p>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {accounts.map(account => (
          <div key={account.account_number} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${ACCOUNT_COLORS[account.account_type] || 'bg-gray-500'} bg-opacity-10 flex items-center justify-center`}>
                <CreditCard size={20} className={`text-${ACCOUNT_COLORS[account.account_type]?.replace('bg-', '') || 'gray-500'}`} />
              </div>
              <span className="text-xs text-gray-500 font-mono">{account.account_number}</span>
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              {ACCOUNT_LABELS[account.account_type] || account.account_type}
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(account.balance)}</p>
            <p className="text-xs text-gray-400 mt-1">{account.currency}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Balance Chart */}
        {accounts.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Balance por Cuenta</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={['#3b82f6', '#10b981', '#8b5cf6'][i % 3]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Transacciones Recientes</h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No hay transacciones aún</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 8).map((txn, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center">
                      {txTypeIcon(txn.type)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-800 capitalize">
                        {txn.type === 'deposit' ? 'Depósito' : txn.type === 'withdrawal' ? 'Retiro' : 'Transferencia'}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(txn.timestamp)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    txn.type === 'deposit' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {txn.type === 'deposit' ? '+' : '-'}{formatCurrency(txn.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Chat />
    </div>
  )
}
