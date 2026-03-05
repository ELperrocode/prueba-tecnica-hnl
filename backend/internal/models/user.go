package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents a bank user stored in PostgreSQL
type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"`
	FullName     string    `gorm:"not null" json:"full_name"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	Accounts []UserAccount `gorm:"foreignKey:UserID" json:"accounts,omitempty"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// UserAccount maps a PostgreSQL user to a TigerBeetle account
type UserAccount struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID        uuid.UUID `gorm:"type:uuid;index;not null" json:"user_id"`
	TBAccountID   uint64    `gorm:"uniqueIndex;not null" json:"tb_account_id"`
	AccountNumber string    `gorm:"uniqueIndex;not null" json:"account_number"`
	AccountType   string    `gorm:"not null" json:"account_type"` // checking, savings, investment
	Currency      string    `gorm:"not null;default:USD" json:"currency"`
	CreatedAt     time.Time `json:"created_at"`
}

// LoginRequest is the request body for login
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// RegisterRequest is the request body for registration
type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
	FullName string `json:"full_name" validate:"required"`
}

// AuthResponse is the response body for login/register
type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// AccountResponse includes balance info from TigerBeetle
type AccountResponse struct {
	AccountNumber string  `json:"account_number"`
	AccountType   string  `json:"account_type"`
	Currency      string  `json:"currency"`
	Balance       float64 `json:"balance"`
	TBAccountID   uint64  `json:"tb_account_id"`
}

// TransactionRequest is the shared request body for transactions
type DepositRequest struct {
	AccountNumber string  `json:"account_number" validate:"required"`
	Amount        float64 `json:"amount" validate:"required,gt=0"`
	Description   string  `json:"description"`
}

type WithdrawRequest struct {
	AccountNumber string  `json:"account_number" validate:"required"`
	Amount        float64 `json:"amount" validate:"required,gt=0"`
	Description   string  `json:"description"`
}

type TransferRequest struct {
	FromAccount string  `json:"from_account" validate:"required"`
	ToAccount   string  `json:"to_account" validate:"required"`
	Amount      float64 `json:"amount" validate:"required,gt=0"`
	Description string  `json:"description"`
}

// TransactionResponse represents a transaction returned from the API
type TransactionResponse struct {
	ID          uint64  `json:"id"`
	FromAccount string  `json:"from_account"`
	ToAccount   string  `json:"to_account"`
	Amount      float64 `json:"amount"`
	Type        string  `json:"type"` // deposit, withdrawal, transfer
	Description string  `json:"description"`
	Timestamp   string  `json:"timestamp"`
}

// ChatMessage represents a single message in the chat history
type ChatMessage struct {
	Role    string `json:"role"`    // "user" or "assistant"
	Content string `json:"content"`
}

// ChatRequest is the request body for AI chat
type ChatRequest struct {
	Message string        `json:"message" validate:"required"`
	History []ChatMessage `json:"history,omitempty"`
}

// ChatResponse is the response body for AI chat
type ChatResponse struct {
	Response       string `json:"response"`
	ActionExecuted string `json:"action_executed,omitempty"`
	RequiresConfirmation bool   `json:"requires_confirmation,omitempty"`
	ConfirmationID       string `json:"confirmation_id,omitempty"`
}

// PaginationQuery for paginated results
type PaginationQuery struct {
	Page  int `json:"page"`
	Limit int `json:"limit"`
}
