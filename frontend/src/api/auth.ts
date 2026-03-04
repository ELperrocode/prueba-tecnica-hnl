import client from './client'
import type { AuthResponse } from '../types'

export const authApi = {
  register: (data: { email: string; password: string; full_name: string }) =>
    client.post<AuthResponse>('/auth/register', data).then(r => r.data),

  login: (data: { email: string; password: string }) =>
    client.post<AuthResponse>('/auth/login', data).then(r => r.data),

  logout: () =>
    client.post('/auth/logout').then(r => r.data),

  me: () =>
    client.get('/auth/me').then(r => r.data),
}
