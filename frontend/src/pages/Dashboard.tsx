import { useEffect, useState } from 'react'
import { accountsApi } from '../api/accounts'
import { transactionsApi } from '../api/transactions'
import { useAuth } from '../contexts/AuthContext'
import type { Account, Transaction } from '../types'
import { CreditCard, Loader2, Wallet, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { formatCurrency, formatDate } from '../utils/format'
import { getAccountConfig } from '../utils/accounts'
import { getTxConfig } from '../utils/transactions'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'

const CHART_COLORS = ['#7c3aed', '#10b981', '#3b82f6', '#f59e0b']

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
  const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0)

  const chartData = accounts.map(a => ({
    name: getAccountConfig(a.account_type).label.replace('Cuenta ', ''),
    balance: a.balance,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={32} className="animate-spin text-violet-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title={`Hola, ${user?.full_name?.split(' ')[0]} 👋`}
        subtitle="Aquí tienes un resumen de tus cuentas"
      />

      {/* Hero balance card */}
      <div className="bg-linear-to-br from-violet-600 via-violet-600 to-violet-700 rounded-2xl p-6 text-white mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 rounded-2xl" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 50%)' }} />
        <div className="relative">
          <p className="text-violet-200 text-sm font-medium tracking-wide uppercase">Balance Total</p>
          <p className="text-3xl sm:text-5xl font-bold mt-1 tracking-tight">{formatCurrency(totalBalance)}</p>
          <p className="text-violet-200 text-sm mt-3">
            {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} activa{accounts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Balance Total"
          value={formatCurrency(totalBalance)}
          Icon={Wallet}
          iconClass="text-violet-600"
          iconBgClass="bg-violet-50"
        />
        <StatCard
          title="Depósitos (recientes)"
          value={formatCurrency(totalDeposits)}
          Icon={TrendingUp}
          iconClass="text-emerald-600"
          iconBgClass="bg-emerald-50"
        />
        <StatCard
          title="Retiros (recientes)"
          value={formatCurrency(totalWithdrawals)}
          Icon={TrendingDown}
          iconClass="text-red-500"
          iconBgClass="bg-red-50"
        />
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {accounts.map(account => {
          const cfg = getAccountConfig(account.account_type)
          return (
            <div key={account.account_number} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${cfg.bgColor} flex items-center justify-center`}>
                  <CreditCard size={20} className={cfg.textColor} />
                </div>
                <span className="text-xs text-slate-400 font-mono">{account.account_number}</span>
              </div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.textColor}`}>
                {cfg.label}
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(account.balance)}</p>
              <p className="text-xs text-slate-400 mt-1">{account.currency}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Balance Bar Chart */}
        {accounts.length > 1 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Balance por Cuenta</h2>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Balance']}
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="balance" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Balance Distribution Pie */}
        {accounts.length > 1 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Distribución de Balance</h2>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="balance"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Balance']}
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {chartData.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {entry.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Transacciones Recientes</h2>
          {transactions.length === 0 ? (
            <EmptyState Icon={ArrowRightLeft} message="No hay transacciones aún" description="Realiza tu primera operación" />
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 8).map((txn, i) => {
                const cfg = getTxConfig(txn.type)
                const { Icon } = cfg
                return (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full ${cfg.bgColor} border ${cfg.borderColor} flex items-center justify-center shrink-0`}>
                        <Icon size={14} className={cfg.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate"><Badge type={txn.type} size="sm" /></p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(txn.timestamp)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${cfg.color}`}>
                      {cfg.sign}{formatCurrency(txn.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
