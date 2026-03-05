import { useState, useEffect, type FormEvent } from 'react'
import { accountsApi } from '../api/accounts'
import { transactionsApi } from '../api/transactions'
import type { Account, Transaction } from '../types'
import { PlusCircle, MinusCircle, ArrowRightLeft, Loader2, CreditCard } from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCurrency } from '../utils/format'
import { getApiError } from '../utils/apiError'
import { getAccountConfig } from '../utils/accounts'
import ErrorBanner from '../components/ui/ErrorBanner'
import SuccessBanner from '../components/ui/SuccessBanner'
import PageHeader from '../components/ui/PageHeader'

type TxType = 'deposit' | 'withdraw' | 'transfer'

const TAB_CONFIG: Record<TxType, { label: string; icon: React.ReactNode; active: string; submit: string }> = {
  deposit: {
    label: 'Depósito',
    icon: <PlusCircle size={18} />,
    active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    submit: 'bg-emerald-600 hover:bg-emerald-700',
  },
  withdraw: {
    label: 'Retiro',
    icon: <MinusCircle size={18} />,
    active: 'bg-red-100 text-red-700 border-red-300',
    submit: 'bg-red-600 hover:bg-red-700',
  },
  transfer: {
    label: 'Transferencia',
    icon: <ArrowRightLeft size={18} />,
    active: 'bg-violet-100 text-violet-700 border-violet-300',
    submit: 'bg-violet-600 hover:bg-violet-700',
  },
}

const TX_LABELS: Record<TxType, { success: (amount: string) => string; submit: string }> = {
  deposit:  { success: (a: string) => `Se depositaron ${a} en tu cuenta`, submit: 'Realizar Depósito' },
  withdraw: { success: (a: string) => `Se retiraron ${a} de tu cuenta`, submit: 'Realizar Retiro' },
  transfer: { success: (a: string) => `Se transfirieron ${a} exitosamente`, submit: 'Realizar Transferencia' },
}

const CHART_COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#3b82f6']

export default function Transactions() {
  const [txType, setTxType] = useState<TxType>('deposit')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<Transaction | null>(null)
  const [error, setError] = useState('')

  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    accountsApi.list().then(data => {
      setAccounts(data)
      if (data.length > 0) {
        setFromAccount(data[0].account_number)
        setToAccount(data[0].account_number)
      }
    })
  }, [])

  const resetForm = () => {
    setAmount('')
    setDescription('')
    setError('')
  }

  const handleTab = (type: TxType) => {
    setTxType(type)
    setError('')
    setSuccess(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(null)
    setLoading(true)

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Ingresa un monto válido mayor a 0')
      setLoading(false)
      return
    }

    try {
      let result: Transaction
      if (txType === 'deposit') {
        result = await transactionsApi.deposit({ account_number: fromAccount, amount: amountNum, description })
      } else if (txType === 'withdraw') {
        result = await transactionsApi.withdraw({ account_number: fromAccount, amount: amountNum, description })
      } else {
        if (fromAccount === toAccount) {
          setError('Las cuentas origen y destino deben ser diferentes')
          setLoading(false)
          return
        }
        result = await transactionsApi.transfer({ from_account: fromAccount, to_account: toAccount, amount: amountNum, description })
      }
      setSuccess(result)
      resetForm()
      const updated = await accountsApi.list()
      setAccounts(updated)
    } catch (err) {
      setError(getApiError(err, 'Error al procesar la transacción'))
    } finally {
      setLoading(false)
    }
  }

  const cfg = TAB_CONFIG[txType]

  const balanceChartData = accounts.map(a => ({
    name: getAccountConfig(a.account_type).label.replace('Cuenta ', ''),
    balance: a.balance,
  }))

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title="Transacciones" subtitle="Realiza operaciones en tus cuentas" />

      {/* Account summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {accounts.map(a => {
          const ac = getAccountConfig(a.account_type)
          return (
            <div key={a.account_number} className={`bg-white border ${ac.borderColor} rounded-xl p-4`}>
              <div className="flex items-start justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg ${ac.bgColor} flex items-center justify-center`}>
                  <CreditCard size={16} className={ac.textColor} />
                </div>
                <span className="text-xs text-slate-400 font-mono">{a.account_number}</span>
              </div>
              <p className={`text-xs font-medium ${ac.textColor}`}>{ac.label}</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">{formatCurrency(a.balance)}</p>
            </div>
          )
        })}
      </div>

      {/* Account balance chart */}
      {accounts.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Balance de Cuentas</h2>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={balanceChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'Balance']}
                contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="balance" radius={[6, 6, 0, 0]}>
                {balanceChartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Form card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(TAB_CONFIG) as TxType[]).map(type => {
            const t = TAB_CONFIG[type]
            const active = txType === type
            return (
              <button
                key={type}
                onClick={() => handleTab(type)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active ? t.active : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.icon}
                <span className="hidden xs:inline sm:inline">{t.label}</span>
              </button>
            )
          })}
        </div>

        {success && <SuccessBanner message={TX_LABELS[txType].success(formatCurrency(success.amount))} />}
        {error && <ErrorBanner message={error} />}

        {(success || error) && <div className="mb-4" />}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source account */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {txType === 'transfer' ? 'Cuenta Origen' : 'Cuenta'}
            </label>
            <select
              value={fromAccount}
              onChange={e => setFromAccount(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
            >
              {accounts.map(a => (
                <option key={a.account_number} value={a.account_number}>
                  {a.account_number} — {formatCurrency(a.balance)}
                </option>
              ))}
            </select>
          </div>

          {/* Destination account */}
          {txType === 'transfer' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta Destino</label>
              <input
                type="text"
                value={toAccount}
                onChange={e => setToAccount(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="4001-XXXX-XXXX-NNNN"
              />
              <p className="text-xs text-slate-400 mt-1">Ingresa el número de cuenta del destinatario</p>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monto (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">$</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                min="0.01"
                step="0.01"
                className="w-full pl-7 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Ej: Pago de alquiler"
            />
          </div>

          <button
            type="submit"
            disabled={loading || accounts.length === 0}
            className={`w-full py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 ${cfg.submit}`}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Procesando...' : TX_LABELS[txType].submit}
          </button>
        </form>
      </div>
    </div>
  )
}
