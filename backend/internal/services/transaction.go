package services

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/henry/banca-online/internal/models"
	tbclient "github.com/henry/banca-online/internal/tigerbeetle"
	"gorm.io/gorm"
)

type TransactionService struct {
	db         *gorm.DB
	tb         *tbclient.Client
	accountSvc *AccountService
}

func NewTransactionService(db *gorm.DB, tb *tbclient.Client, accountSvc *AccountService) *TransactionService {
	return &TransactionService{db: db, tb: tb, accountSvc: accountSvc}
}

// Deposit adds funds to an account (operator/bank -> user account)
func (s *TransactionService) Deposit(userID uuid.UUID, req models.DepositRequest) (*models.TransactionResponse, error) {
	// Validate account ownership
	if !s.accountSvc.UserOwnsAccount(userID, req.AccountNumber) {
		return nil, fmt.Errorf("account %s does not belong to this user", req.AccountNumber)
	}

	ua, err := s.accountSvc.GetAccountByNumber(req.AccountNumber)
	if err != nil {
		return nil, err
	}

	amountCents := tbclient.DollarsToCents(req.Amount)
	transferID := generateTransferID()

	// Deposit: debit the operator account, credit the user account
	err = s.tb.CreateTransfer(
		transferID,
		tbclient.OperatorAccountID, // debit (source: bank)
		ua.TBAccountID,             // credit (destination: user)
		amountCents,
		tbclient.TransferCodeDeposit,
	)
	if err != nil {
		return nil, fmt.Errorf("creating deposit transfer: %w", err)
	}

	return &models.TransactionResponse{
		ID:          transferID,
		FromAccount: "EXTERNAL",
		ToAccount:   req.AccountNumber,
		Amount:      req.Amount,
		Type:        "deposit",
		Description: req.Description,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// Withdraw removes funds from an account (user account -> operator/bank)
func (s *TransactionService) Withdraw(userID uuid.UUID, req models.WithdrawRequest) (*models.TransactionResponse, error) {
	// Validate account ownership
	if !s.accountSvc.UserOwnsAccount(userID, req.AccountNumber) {
		return nil, fmt.Errorf("account %s does not belong to this user", req.AccountNumber)
	}

	ua, err := s.accountSvc.GetAccountByNumber(req.AccountNumber)
	if err != nil {
		return nil, err
	}

	amountCents := tbclient.DollarsToCents(req.Amount)

	// Check balance
	balance, err := s.tb.GetAccountBalance(ua.TBAccountID)
	if err != nil {
		return nil, fmt.Errorf("checking balance: %w", err)
	}
	if balance < amountCents {
		return nil, fmt.Errorf("insufficient funds: available %.2f, requested %.2f",
			tbclient.CentsToDollars(balance), req.Amount)
	}

	transferID := generateTransferID()

	// Withdrawal: debit user account, credit operator account
	err = s.tb.CreateTransfer(
		transferID,
		ua.TBAccountID,             // debit (source: user)
		tbclient.OperatorAccountID, // credit (destination: bank)
		amountCents,
		tbclient.TransferCodeWithdrawal,
	)
	if err != nil {
		return nil, fmt.Errorf("creating withdrawal transfer: %w", err)
	}

	return &models.TransactionResponse{
		ID:          transferID,
		FromAccount: req.AccountNumber,
		ToAccount:   "EXTERNAL",
		Amount:      req.Amount,
		Type:        "withdrawal",
		Description: req.Description,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// Transfer sends money between two accounts
func (s *TransactionService) Transfer(userID uuid.UUID, req models.TransferRequest) (*models.TransactionResponse, error) {
	// Validate sender account ownership
	if !s.accountSvc.UserOwnsAccount(userID, req.FromAccount) {
		return nil, fmt.Errorf("account %s does not belong to this user", req.FromAccount)
	}

	fromUA, err := s.accountSvc.GetAccountByNumber(req.FromAccount)
	if err != nil {
		return nil, fmt.Errorf("source account not found: %w", err)
	}

	toUA, err := s.accountSvc.GetAccountByNumber(req.ToAccount)
	if err != nil {
		return nil, fmt.Errorf("destination account not found: %w", err)
	}

	if fromUA.TBAccountID == toUA.TBAccountID {
		return nil, fmt.Errorf("cannot transfer to the same account")
	}

	amountCents := tbclient.DollarsToCents(req.Amount)

	// Check balance
	balance, err := s.tb.GetAccountBalance(fromUA.TBAccountID)
	if err != nil {
		return nil, fmt.Errorf("checking balance: %w", err)
	}
	if balance < amountCents {
		return nil, fmt.Errorf("insufficient funds: available %.2f, requested %.2f",
			tbclient.CentsToDollars(balance), req.Amount)
	}

	transferID := generateTransferID()

	// Transfer: debit sender, credit receiver
	err = s.tb.CreateTransfer(
		transferID,
		fromUA.TBAccountID, // debit (source)
		toUA.TBAccountID,   // credit (destination)
		amountCents,
		tbclient.TransferCodeTransfer,
	)
	if err != nil {
		return nil, fmt.Errorf("creating transfer: %w", err)
	}

	return &models.TransactionResponse{
		ID:          transferID,
		FromAccount: req.FromAccount,
		ToAccount:   req.ToAccount,
		Amount:      req.Amount,
		Type:        "transfer",
		Description: req.Description,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// GetTransactionHistory returns recent transactions for all user accounts
func (s *TransactionService) GetTransactionHistory(userID uuid.UUID, limit int) ([]models.TransactionResponse, error) {
	accounts, err := s.accountSvc.GetAccountsByUserID(userID)
	if err != nil {
		return nil, err
	}

	// Build a map of TBAccountID -> AccountNumber for lookups
	tbToAccountNum := make(map[uint64]string)
	for _, a := range accounts {
		tbToAccountNum[a.TBAccountID] = a.AccountNumber
	}

	// Also build a full lookup for all accounts (for displaying other party)
	allAccountsMap := make(map[uint64]string)
	var allAccounts []models.UserAccount
	s.db.Find(&allAccounts)
	for _, a := range allAccounts {
		allAccountsMap[a.TBAccountID] = a.AccountNumber
	}

	var allTransfers []models.TransactionResponse
	seen := make(map[uint64]bool)

	for _, ua := range accounts {
		transfers, err := s.tb.GetAccountTransfers(ua.TBAccountID, uint32(limit))
		if err != nil {
			continue
		}

		for _, t := range transfers {
			tid := tbclient.Uint128ToUint64(t.ID)
			if seen[tid] {
				continue
			}
			seen[tid] = true

			debitID := tbclient.Uint128ToUint64(t.DebitAccountID)
			creditID := tbclient.Uint128ToUint64(t.CreditAccountID)
			amount := tbclient.CentsToDollars(tbclient.Uint128ToUint64(t.Amount))

			fromAcct := resolveAccountName(debitID, allAccountsMap)
			toAcct := resolveAccountName(creditID, allAccountsMap)

			txnType := "transfer"
			switch t.Code {
			case tbclient.TransferCodeDeposit:
				txnType = "deposit"
			case tbclient.TransferCodeWithdrawal:
				txnType = "withdrawal"
			}

			ts := time.Unix(0, int64(t.Timestamp)).UTC().Format(time.RFC3339)

			allTransfers = append(allTransfers, models.TransactionResponse{
				ID:          tid,
				FromAccount: fromAcct,
				ToAccount:   toAcct,
				Amount:      amount,
				Type:        txnType,
				Timestamp:   ts,
			})
		}
	}

	// Limit results
	if len(allTransfers) > limit {
		allTransfers = allTransfers[:limit]
	}

	return allTransfers, nil
}

func resolveAccountName(tbID uint64, accountMap map[uint64]string) string {
	if tbID == tbclient.OperatorAccountID {
		return "EXTERNAL"
	}
	if name, ok := accountMap[tbID]; ok {
		return name
	}
	return fmt.Sprintf("TB-%d", tbID)
}

func generateTransferID() uint64 {
	// Use timestamp + random to generate unique IDs
	return uint64(time.Now().UnixNano()/1000) + uint64(rand.Intn(1000))
}
