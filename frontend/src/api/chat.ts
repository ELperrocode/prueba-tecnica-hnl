import client from './client'

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  response: string;
  action_executed?: string;
}

export const chatApi = {
  send: (message: string, history: ChatHistoryMessage[] = []) =>
    client.post<ChatResponse>('/chat', { message, history }).then(r => r.data),
}
