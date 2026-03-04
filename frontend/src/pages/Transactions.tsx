import { useState, useEffect, type FormEvent } from 'react'
import { accountsApi } from '../api/accounts'
import { transactionsApi } from '../api/transactions'
import type { Account, Transaction } from '../types'
import { PlusCircle, MinusCircle, ArrowRightLeft, CheckCircle, XCircle } from 'lucide-react'
import Chat from '../components/Chat'

type TxType = 'deposit' | 'withdraw' | 'transfer'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function Transactions() {
  const [txType, setTxType] = useState<TxType>('deposit')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<Transaction | null>(null)
  const [error, setError] = useState('')

  // Form state
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
      // Refresh accounts
      const updated = await accountsApi.list()
      setAccounts(updated)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response: { data: { error: string } } }).response?.data?.error
        : 'Error al procesar la transacción'
      setError(msg || 'Error al procesar la transacción')
    } finally {
      setLoading(false)
    }
  }

  const tabs: { type: TxType; label: string; icon: React.ReactNode; color: string }[] = [
    { type: 'deposit', label: 'Depósito', icon: <PlusCircle size={18} />, color: 'emerald' },
    { type: 'withdraw', label: 'Retiro', icon: <MinusCircle size={18} />, color: 'red' },
    { type: 'transfer', label: 'Transferencia', icon: <ArrowRightLeft size={18} />, color: 'blue' },
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transacciones</h1>
        <p className="text-gray-500 text-sm mt-1">Realiza operaciones en tus cuentas</p>
      </div>

      {/* Accounts summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {accounts.map(a => (
          <div key={a.account_number} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 font-mono">{a.account_number}</p>
            <p className="text-xs text-gray-500 capitalize mt-0.5">{a.account_type}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(a.balance)}</p>
          </div>
        ))}
      </div>

      {/* Transaction Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.type}
              onClick={() => { setTxType(tab.type); setError(''); setSuccess(null) }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                txType === tab.type
                  ? tab.type === 'deposit' ? 'bg-emerald-100 text-emerald-700'
                    : tab.type === 'withdraw' ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-emerald-800 font-medium text-sm">Transacción exitosa</p>
              <p className="text-emerald-700 text-xs mt-1">
                {txType === 'deposit' && `Se depositaron ${formatCurrency(success.amount)} en tu cuenta`}
                {txType === 'withdraw' && `Se retiraron ${formatCurrency(success.amount)} de tu cuenta`}
                {txType === 'transfer' && `Se transfirieron ${formatCurrency(success.amount)} exitosamente`}
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <XCircle size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {txType === 'transfer' ? 'Cuenta Origen' : 'Cuenta'}
            </label>
            <select
              value={fromAccount}
              onChange={e => setFromAccount(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accounts.map(a => (
                <option key={a.account_number} value={a.account_number}>
                  {a.account_number} ({a.account_type}) — {formatCurrency(a.balance)}
                </option>
              ))}
            </select>
          </div>

          {/* Destination account for transfers */}
          {txType === 'transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Destino</label>
              <input
                type="text"
                value={toAccount}
                onChange={e => setToAccount(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="4001-XXXX-XXXX-NNNN"
              />
              <p className="text-xs text-gray-400 mt-1">Ingresa el número de cuenta del destinatario</p>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">$</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                min="0.01"
                step="0.01"
                className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Pago de alquiler"
            />
          </div>

          <button
            type="submit"
            disabled={loading || accounts.length === 0}
            className={`w-full py-2.5 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm ${
              txType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700'
                : txType === 'withdraw' ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Procesando...' : (
              txType === 'deposit' ? 'Realizar Depósito'
                : txType === 'withdraw' ? 'Realizar Retiro'
                : 'Realizar Transferencia'
            )}
          </button>
        </form>
      </div>

      <Chat />
    </div>
  )
}
