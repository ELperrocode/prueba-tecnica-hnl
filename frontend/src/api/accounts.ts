import client from './client'
import type { Account } from '../types'

export const accountsApi = {
  list: () =>
    client.get<Account[]>('/accounts').then(r => r.data),

  get: (accountNumber: string) =>
    client.get<Account>(`/accounts/${accountNumber}`).then(r => r.data),
}
