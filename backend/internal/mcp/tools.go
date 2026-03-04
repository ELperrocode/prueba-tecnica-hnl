package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/henry/banca-online/internal/models"
	"github.com/henry/banca-online/internal/services"
)

// Tool represents an MCP-compatible tool definition
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// ToolResult represents the output of a tool call
type ToolResult struct {
	Content string      `json:"content"`
	Data    interface{} `json:"data,omitempty"`
}

// ToolRegistry holds all available MCP tools
type ToolRegistry struct {
	tools      map[string]Tool
	handlers   map[string]func(ctx context.Context, userID uuid.UUID, args map[string]interface{}) (*ToolResult, error)
	accountSvc *services.AccountService
	txnSvc     *services.TransactionService
}

// NewToolRegistry creates a new registry with all banking tools
func NewToolRegistry(accountSvc *services.AccountService, txnSvc *services.TransactionService) *ToolRegistry {
	r := &ToolRegistry{
		tools:      make(map[string]Tool),
		handlers:   make(map[string]func(ctx context.Context, userID uuid.UUID, args map[string]interface{}) (*ToolResult, error)),
		accountSvc: accountSvc,
		txnSvc:     txnSvc,
	}
	r.registerTools()
	return r
}

func (r *ToolRegistry) registerTools() {
	// get_accounts - List all user accounts with balances
	r.register(Tool{
		Name:        "get_accounts",
		Description: "Get all bank accounts for the current user, including balances. Use this when the user asks about their accounts or balances.",
		Parameters: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
			"required":   []string{},
		},
	}, r.handleGetAccounts)

	// get_balance - Get balance for a specific account
	r.register(Tool{
		Name:        "get_balance",
		Description: "Get the balance of a specific bank account by its account number.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"account_number": map[string]interface{}{
					"type":        "string",
					"description": "The account number (e.g., 4001-XXXX-XXXX-NNNN)",
				},
			},
			"required": []string{"account_number"},
		},
	}, r.handleGetBalance)

	// get_transactions - Get recent transaction history
	r.register(Tool{
		Name:        "get_transactions",
		Description: "Get recent transaction history for the user. Returns deposits, withdrawals, and transfers.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"limit": map[string]interface{}{
					"type":        "number",
					"description": "Maximum number of transactions to return (default: 10, max: 50)",
				},
			},
			"required": []string{},
		},
	}, r.handleGetTransactions)

	// make_deposit - Deposit money
	r.register(Tool{
		Name:        "make_deposit",
		Description: "Deposit money into a bank account. IMPORTANT: Always confirm with the user before executing.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"account_number": map[string]interface{}{
					"type":        "string",
					"description": "The destination account number",
				},
				"amount": map[string]interface{}{
					"type":        "number",
					"description": "The amount in USD to deposit",
				},
				"description": map[string]interface{}{
					"type":        "string",
					"description": "Description for the deposit",
				},
			},
			"required": []string{"account_number", "amount"},
		},
	}, r.handleMakeDeposit)

	// make_withdrawal - Withdraw money
	r.register(Tool{
		Name:        "make_withdrawal",
		Description: "Withdraw money from a bank account. IMPORTANT: Always confirm with the user before executing.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"account_number": map[string]interface{}{
					"type":        "string",
					"description": "The source account number",
				},
				"amount": map[string]interface{}{
					"type":        "number",
					"description": "The amount in USD to withdraw",
				},
				"description": map[string]interface{}{
					"type":        "string",
					"description": "Description for the withdrawal",
				},
			},
			"required": []string{"account_number", "amount"},
		},
	}, r.handleMakeWithdrawal)

	// make_transfer - Transfer money between accounts
	r.register(Tool{
		Name:        "make_transfer",
		Description: "Transfer money from one bank account to another. IMPORTANT: Always confirm with the user before executing.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"from_account": map[string]interface{}{
					"type":        "string",
					"description": "The source account number",
				},
				"to_account": map[string]interface{}{
					"type":        "string",
					"description": "The destination account number",
				},
				"amount": map[string]interface{}{
					"type":        "number",
					"description": "The amount in USD to transfer",
				},
				"description": map[string]interface{}{
					"type":        "string",
					"description": "Description for the transfer",
				},
			},
			"required": []string{"from_account", "to_account", "amount"},
		},
	}, r.handleMakeTransfer)
}

func (r *ToolRegistry) register(tool Tool, handler func(ctx context.Context, userID uuid.UUID, args map[string]interface{}) (*ToolResult, error)) {
	r.tools[tool.Name] = tool
	r.handlers[tool.Name] = handler
}

// GetTools returns all tool definitions
func (r *ToolRegistry) GetTools() []Tool {
	tools := make([]Tool, 0, len(r.tools))
	for _, t := range r.tools {
		tools = append(tools, t)
	}
	return tools
}

// ToOpenRouterTools converts tools to OpenRouter function calling format
func (r *ToolRegistry) ToOpenRouterTools() []map[string]interface{} {
	tools := make([]map[string]interface{}, 0, len(r.tools))
	for _, t := range r.tools {
		tools = append(tools, map[string]interface{}{
			"type": "function",
			"function": map[string]interface{}{
				"name":        t.Name,
				"description": t.Description,
				"parameters":  t.Parameters,
			},
		})
	}
	return tools
}

// ExecuteTool executes a tool by name with the given arguments
func (r *ToolRegistry) ExecuteTool(ctx context.Context, userID uuid.UUID, toolName string, argsJSON string) (*ToolResult, error) {
	handler, ok := r.handlers[toolName]
	if !ok {
		return nil, fmt.Errorf("unknown tool: %s", toolName)
	}

	var args map[string]interface{}
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		return nil, fmt.Errorf("parsing tool arguments: %w", err)
	}

	return handler(ctx, userID, args)
}

// --- Tool Handlers ---

func (r *ToolRegistry) handleGetAccounts(ctx context.Context, userID uuid.UUID, args map[string]interface{}) (*ToolResult, error) {
	accounts, err := r.accountSvc.GetUserAccounts(userID)
	if err != nil {
		return nil, err
	}

	data, _ := json.MarshalIndent(accounts, "", "  ")
	return &ToolResult{
		Content: fmt.Sprintf("User has %d account(s):\n%s", len(accounts), string(data)),
		Data:    accounts,
	}, nil
}

func (r *ToolRegistry) handleGetBalance(ctx context.Context, userID uuid.UUID, args map[string]interface{}) (*ToolResult, error) {
	accountNumber, _ := args["account_number"].(string)
	if accountNumber == "" {
		return nil, fmt.Errorf("account_number is required")
	}

	if !r.accountSvc.UserOwnsAccount(userID, accountNumber) {
		return nil, fmt.Errorf("account %s does not belong to this user", accountNumber)
	}

	account, err := r.accountSvc.GetAccountWithBalance(accountNumber)
	if err != nil {
		return nil, err
	}

	return &ToolResult{
		Content: fmt.Sprintf("Account %s (%s): $%.2f %s", account.AccountNumber, account.AccountType, account.Balance, account.Currency),
		Data:    account,
	}, nil
}

func (r *ToolRegistry) handleGetTransactions(ctx context.Context, userID uuid.UUID, args map[string]interface{}) (*ToolResult, error) {
	limit := 10
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
		if limit > 50 {
			limit = 50
		}
	}

	transactions, err := r.txnSvc.GetTransactionHistory(userID, limit)
	if err != nil {
		return nil, err
	}

	data, _ := json.MarshalIndent(transactions, "", "  ")
	return &ToolResult{
		Content: fmt.Sprintf("Found %d recent transaction(s):\n%s", len(transactions), string(data)),
		Data:    transactions,
	}, nil
}

func (r *ToolRegistry) handleMakeDeposit(ctx context.Context, userID uuid.UUID, args map[string]interface{}) (*ToolResult, error) {
	accountNumber, _ := args["account_number"].(string)
	amount, _ := args["amount"].(float64)
	description, _ := args["description"].(string)

	if accountNumber == "" || amount <= 0 {
		return nil, fmt.Errorf("account_number and positive amount are required")
	}

	if description == "" {
		description = "Deposit via AI chat"
	}

	resp, err := r.txnSvc.Deposit(userID, models.DepositRequest{
		AccountNumber: accountNumber,
		Amount:        amount,
		Description:   description,
	})
	if err != nil {
		return nil, err
	}

	return &ToolResult{
		Content: fmt.Sprintf("Deposit successful: $%.2f deposited to account %s", amount, accountNumber),
		Data:    resp,
	}, nil
}

func (r *ToolRegistry) handleMakeWithdrawal(ctx context.Context, userID uuid.UUID, args map[string]interface{}) (*ToolResult, error) {
	accountNumber, _ := args["account_number"].(string)
	amount, _ := args["amount"].(float64)
	description, _ := args["description"].(string)

	if accountNumber == "" || amount <= 0 {
		return nil, fmt.Errorf("account_number and positive amount are required")
	}

	if description == "" {
		description = "Withdrawal via AI chat"
	}

	resp, err := r.txnSvc.Withdraw(userID, models.WithdrawRequest{
		AccountNumber: accountNumber,
		Amount:        amount,
		Description:   description,
	})
	if err != nil {
		return nil, err
	}

	return &ToolResult{
		Content: fmt.Sprintf("Withdrawal successful: $%.2f withdrawn from account %s", amount, accountNumber),
		Data:    resp,
	}, nil
}

func (r *ToolRegistry) handleMakeTransfer(ctx context.Context, userID uuid.UUID, args map[string]interface{}) (*ToolResult, error) {
	fromAccount, _ := args["from_account"].(string)
	toAccount, _ := args["to_account"].(string)
	amount, _ := args["amount"].(float64)
	description, _ := args["description"].(string)

	if fromAccount == "" || toAccount == "" || amount <= 0 {
		return nil, fmt.Errorf("from_account, to_account, and positive amount are required")
	}

	if description == "" {
		description = "Transfer via AI chat"
	}

	resp, err := r.txnSvc.Transfer(userID, models.TransferRequest{
		FromAccount: fromAccount,
		ToAccount:   toAccount,
		Amount:      amount,
		Description: description,
	})
	if err != nil {
		return nil, err
	}

	return &ToolResult{
		Content: fmt.Sprintf("Transfer successful: $%.2f from %s to %s", amount, fromAccount, toAccount),
		Data:    resp,
	}, nil
}
