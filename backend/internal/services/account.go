package services

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/henry/banca-online/internal/models"
	tbclient "github.com/henry/banca-online/internal/tigerbeetle"
	"gorm.io/gorm"
)

type AccountService struct {
	db *gorm.DB
	tb *tbclient.Client
}

func NewAccountService(db *gorm.DB, tb *tbclient.Client) *AccountService {
	return &AccountService{db: db, tb: tb}
}

// CreateAccount creates a new bank account for a user
func (s *AccountService) CreateAccount(userID uuid.UUID, accountNumber, accountType, currency string) (*models.UserAccount, error) {
	// Create record in PostgreSQL first to get auto-incremented ID
	ua := models.UserAccount{
		UserID:        userID,
		AccountNumber: accountNumber,
		AccountType:   accountType,
		Currency:      currency,
	}
	if err := s.db.Create(&ua).Error; err != nil {
		return nil, fmt.Errorf("creating user_account record: %w", err)
	}

	// Use the auto-increment ID as the TigerBeetle account ID
	ua.TBAccountID = uint64(ua.ID)
	if err := s.db.Save(&ua).Error; err != nil {
		return nil, fmt.Errorf("updating tb_account_id: %w", err)
	}

	// Create account in TigerBeetle (no timestamp = normal, non-imported account)
	if err := s.tb.CreateAccount(ua.TBAccountID, accountType); err != nil {
		return nil, fmt.Errorf("creating TigerBeetle account: %w", err)
	}

	return &ua, nil
}

// GetUserAccounts returns all accounts for a user with balances
func (s *AccountService) GetUserAccounts(userID uuid.UUID) ([]models.AccountResponse, error) {
	var userAccounts []models.UserAccount
	if err := s.db.Where("user_id = ?", userID).Find(&userAccounts).Error; err != nil {
		return nil, fmt.Errorf("fetching user accounts: %w", err)
	}

	responses := make([]models.AccountResponse, 0, len(userAccounts))
	for _, ua := range userAccounts {
		balanceCents, err := s.tb.GetAccountBalance(ua.TBAccountID)
		if err != nil {
			return nil, fmt.Errorf("getting balance for account %s: %w", ua.AccountNumber, err)
		}

		responses = append(responses, models.AccountResponse{
			AccountNumber: ua.AccountNumber,
			AccountType:   ua.AccountType,
			Currency:      ua.Currency,
			Balance:       tbclient.CentsToDollars(balanceCents),
			TBAccountID:   ua.TBAccountID,
		})
	}

	return responses, nil
}

// GetAccountByNumber returns a single account by its account number
func (s *AccountService) GetAccountByNumber(accountNumber string) (*models.UserAccount, error) {
	var ua models.UserAccount
	if err := s.db.Where("account_number = ?", accountNumber).First(&ua).Error; err != nil {
		return nil, fmt.Errorf("account %s not found", accountNumber)
	}
	return &ua, nil
}

// GetAccountWithBalance returns account info with current balance
func (s *AccountService) GetAccountWithBalance(accountNumber string) (*models.AccountResponse, error) {
	ua, err := s.GetAccountByNumber(accountNumber)
	if err != nil {
		return nil, err
	}

	balanceCents, err := s.tb.GetAccountBalance(ua.TBAccountID)
	if err != nil {
		return nil, fmt.Errorf("getting balance: %w", err)
	}

	return &models.AccountResponse{
		AccountNumber: ua.AccountNumber,
		AccountType:   ua.AccountType,
		Currency:      ua.Currency,
		Balance:       tbclient.CentsToDollars(balanceCents),
		TBAccountID:   ua.TBAccountID,
	}, nil
}

// UserOwnsAccount checks if a user owns a specific account
func (s *AccountService) UserOwnsAccount(userID uuid.UUID, accountNumber string) bool {
	var count int64
	s.db.Model(&models.UserAccount{}).
		Where("user_id = ? AND account_number = ?", userID, accountNumber).
		Count(&count)
	return count > 0
}

// GetAccountsByUserID returns UserAccount records for a user
func (s *AccountService) GetAccountsByUserID(userID uuid.UUID) ([]models.UserAccount, error) {
	var accounts []models.UserAccount
	if err := s.db.Where("user_id = ?", userID).Find(&accounts).Error; err != nil {
		return nil, err
	}
	return accounts, nil
}
