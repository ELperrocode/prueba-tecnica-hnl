import client from './client'

interface ChatResponse {
  response: string;
  action_executed?: string;
}

export const chatApi = {
  send: (message: string) =>
    client.post<ChatResponse>('/chat', { message }).then(r => r.data),
}
