import client from './client'
import type { Transaction } from '../types'

export const transactionsApi = {
  history: (limit = 50) =>
    client.get<Transaction[]>(`/transactions?limit=${limit}`).then(r => r.data),

  deposit: (data: { account_number: string; amount: number; description?: string }) =>
    client.post<Transaction>('/transactions/deposit', data).then(r => r.data),

  withdraw: (data: { account_number: string; amount: number; description?: string }) =>
    client.post<Transaction>('/transactions/withdraw', data).then(r => r.data),

  transfer: (data: { from_account: string; to_account: string; amount: number; description?: string }) =>
    client.post<Transaction>('/transactions/transfer', data).then(r => r.data),

  exportCSV: async () => {
    const res = await client.get('/transactions/export', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `historial-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },
}
