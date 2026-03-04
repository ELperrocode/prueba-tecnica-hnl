// Shared TypeScript types for the banking API

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface Account {
  account_number: string;
  account_type: 'checking' | 'savings' | 'investment';
  currency: string;
  balance: number;
  tb_account_id: number;
}

export interface Transaction {
  id: number;
  from_account: string;
  to_account: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer';
  description: string;
  timestamp: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
