# BancaHNL — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network: banca-net                │
│                                                                 │
│  ┌──────────────┐    ┌────────────────────────────────────────┐ │
│  │   Frontend   │    │              Backend (Go)              │ │
│  │  React+Vite  │───▶│  chi router / JWT middleware           │ │
│  │  nginx :80   │    │  handlers → services → TigerBeetle     │ │
│  │              │    │            └───────→ PostgreSQL         │ │
│  └──────────────┘    └──────────────┬─────────────┬───────────┘ │
│        :3000                        │             │             │
│                         ┌───────────┘   ┌─────────┘           │
│                         ▼               ▼                      │
│                  ┌────────────┐  ┌────────────┐                │
│                  │TigerBeetle │  │ PostgreSQL │                │
│                  │  :3000     │  │   :5432    │                │
│                  │ (ledger)   │  │  (users)   │                │
│                  └────────────┘  └────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                    POST /api/chat
                              │
                    ┌─────────▼──────────┐
                    │   OpenRouter API   │
                    │  Claude Sonnet 4   │
                    │  (function calls)  │
                    └────────────────────┘
```

## Data Flow — Deposit

```
Client → POST /api/transactions/deposit
           │
           ▼
     AuthMiddleware (validates JWT, injects userID into ctx)
           │
           ▼
     TransactionHandler.Deposit()
           │
           ▼
     TransactionService.Deposit()
       1. UserOwnsAccount(userID, accountNumber) → PostgreSQL
       2. GetAccountByNumber(accountNumber)      → PostgreSQL
       3. DollarsToCents(amount)
       4. generateTransferID()
       5. tb.CreateTransfer(id, OperatorID, userTBID, cents, CodeDeposit)
                                                    → TigerBeetle
           │
           ▼
     returns TransactionResponse { id, amount, type, timestamp, ... }
```

## Data Flow — AI Chat

```
Client → POST /api/chat { message: "¿Cuánto tengo en mi cuenta?" }
           │
           ▼
     ChatHandler.Chat()
       1. GetUserAccounts() → context string for system prompt
       2. Build messages: [system, user]
       3. → callOpenRouter(messages, mcpTools)
             │
             ▼
           OpenRouter (Claude Sonnet 4)
             - Returns tool_call: get_accounts {}
             │
             ▼
       4. toolRegistry.ExecuteTool("get_accounts", userID)
             - calls AccountService.GetUserAccounts()
             - returns JSON with balances
             │
             ▼
       5. Append tool result, → callOpenRouter again
             │
             ▼
           OpenRouter (Claude Sonnet 4)
             - Returns text: "Tienes $1,234.56 en tu cuenta corriente..."
           │
           ▼
     returns ChatResponse { response: "..." }
```

## Database Responsibilities

| Data | Store | Why |
|------|-------|-----|
| User identities, passwords | PostgreSQL | Relational, bcrypt hashing |
| Account metadata | PostgreSQL | Joins with users |
| Account balances | TigerBeetle | Double-entry, immutable, fast |
| Transaction history | TigerBeetle | Append-only ledger |

The PostgreSQL `user_accounts.id` (auto-increment uint) is the foreign key to TigerBeetle — cast to `uint64`.

## Authentication Flow

```
Register/Login → bcrypt verify → generate JWT (HS256, 24h)
                                         │
                                         ▼ stored in localStorage
All API calls → Authorization: Bearer <token>
                                         │
                        AuthMiddleware → jwt.Parse → userID (UUID)
                                                         │
                                              context.WithValue(r.Context(), UserIDKey, userID)
```

## TigerBeetle Account Flags

```
User accounts:
  flags.debits_must_not_exceed_credits = true  (prevents overdraft)
  flags.history = true                         (enables balance queries)
  flags.linked = false

Operator account:
  No debit limit (unlimited — it's the bank)
  flags.history = true

Seeded accounts:
  flags.imported = true (during seed only)
```

## MCP Tool Architecture

```
ToolRegistry
  ├── tools map[name]Tool          (JSON Schema definitions for OpenRouter)
  ├── handlers map[name]func       (Go implementation)
  └── services (AccountSvc, TxnSvc)

OpenRouter function calling format:
  tools[i] = {
    type: "function",
    function: {
      name: "make_transfer",
      description: "...",
      parameters: { JSON Schema }
    }
  }

Tool call loop (max 5 iterations):
  messages → OpenRouter
    if finish_reason == "tool_calls"
      → execute each tool call
      → append role:"tool" messages with results
      → loop
    else
      → return final text response
```

## File Naming Conventions

- Go: `snake_case` files, `PascalCase` exported types/functions
- TypeScript: `camelCase` files, `PascalCase` components/types
- Routes: `/api/resource` (plural nouns), `POST` for mutations

## Error Handling Convention

### Backend
```go
// Services return descriptive errors
return nil, fmt.Errorf("insufficient balance: have %d cents, need %d", balance, amount)

// Handlers map errors to HTTP status
if err != nil {
    writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
    return
}
```

### Frontend
```ts
// All API errors become { error: string } in response body
const msg = err?.response?.data?.error || 'Error al procesar la transacción'
setError(msg)
```
