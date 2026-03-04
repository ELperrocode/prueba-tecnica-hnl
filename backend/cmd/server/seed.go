package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/henry/banca-online/internal/models"
	tbclient "github.com/henry/banca-online/internal/tigerbeetle"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// SeedData represents the structure of the seed JSON file
type SeedData struct {
	Users        []SeedUser        `json:"users"`
	Accounts     []SeedAccount     `json:"accounts"`
	Transactions []SeedTransaction `json:"transactions"`
}

type SeedUser struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	FullName  string `json:"full_name"`
	CreatedAt string `json:"created_at"`
}

type SeedAccount struct {
	AccountNumber  string  `json:"account_number"`
	UserID         string  `json:"user_id"`
	InitialBalance float64 `json:"initial_balance"`
	Currency       string  `json:"currency"`
	AccountType    string  `json:"account_type"`
}

type SeedTransaction struct {
	FromAccount string  `json:"from_account"`
	ToAccount   string  `json:"to_account"`
	Amount      float64 `json:"amount"`
	Type        string  `json:"type"`
	Description string  `json:"description"`
	Timestamp   string  `json:"timestamp"`
	Status      string  `json:"status"`
}

func seedDatabase(db *gorm.DB, tb *tbclient.Client) error {
	// Check if already fully seeded (users AND accounts present)
	var userCount, accountCount int64
	db.Model(&models.User{}).Count(&userCount)
	db.Model(&models.UserAccount{}).Count(&accountCount)
	if userCount > 0 && accountCount > 0 {
		log.Printf("Database already seeded (%d users, %d accounts), skipping", userCount, accountCount)
		return nil
	}

	// Find seed data file
	seedFile := findSeedFile()
	if seedFile == "" {
		log.Println("No seed data file found, skipping seed")
		return nil
	}

	log.Printf("Loading seed data from %s...", seedFile)
	data, err := os.ReadFile(seedFile)
	if err != nil {
		return fmt.Errorf("reading seed file: %w", err)
	}

	var seed SeedData
	if err := json.Unmarshal(data, &seed); err != nil {
		return fmt.Errorf("parsing seed file: %w", err)
	}

	log.Printf("Seed data: %d users, %d accounts, %d transactions",
		len(seed.Users), len(seed.Accounts), len(seed.Transactions))

	// Step 1: Create the operator/bank account in TigerBeetle
	log.Println("Creating operator account in TigerBeetle...")
	if err := tb.CreateOperatorAccount(); err != nil {
		log.Printf("Operator account note: %v", err)
	}

	// Step 2: Create users in PostgreSQL
	// Track UUIDs that exist in PG so we can skip accounts for missing users.
	successfulUserIDs := make(map[string]bool)

	log.Println("Seeding users...")
	for i, su := range seed.Users {
		userID, err := uuid.Parse(su.ID)
		if err != nil {
			log.Printf("Invalid user ID %s, skipping", su.ID)
			continue
		}

		// Fast-path: skip bcrypt if user already exists in PostgreSQL.
		var existing models.User
		if db.Where("id = ?", userID).First(&existing).Error == nil {
			successfulUserIDs[su.ID] = true
			continue
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(su.Password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hashing password for user %s: %w", su.Email, err)
		}

		createdAt, _ := time.Parse(time.RFC3339, su.CreatedAt)

		user := models.User{
			ID:           userID,
			Email:        su.Email,
			PasswordHash: string(hash),
			FullName:     su.FullName,
			CreatedAt:    createdAt,
			UpdatedAt:    createdAt,
		}

		if err := db.Create(&user).Error; err != nil {
			// Duplicate email means user already exists with the same UUID — still usable.
			if db.Where("id = ?", userID).First(&existing).Error == nil {
				successfulUserIDs[su.ID] = true
			} else {
				log.Printf("Error creating user %s: %v", su.Email, err)
			}
			continue
		}
		successfulUserIDs[su.ID] = true

		if (i+1)%100 == 0 {
			log.Printf("  Created %d/%d users", i+1, len(seed.Users))
		}
	}
	log.Printf("Created/verified %d users", len(successfulUserIDs))

	// Step 3: Create accounts in PostgreSQL + TigerBeetle
	// We need a mapping from account_number to TigerBeetle ID
	accountMap := make(map[string]uint64) // account_number -> tb_account_id

	log.Println("Seeding accounts...")
	for i, sa := range seed.Accounts {
		// Skip accounts for users that don't exist in PostgreSQL.
		if !successfulUserIDs[sa.UserID] {
			continue
		}

		userID, err := uuid.Parse(sa.UserID)
		if err != nil {
			log.Printf("Invalid user_id %s for account %s, skipping", sa.UserID, sa.AccountNumber)
			continue
		}

		// Check if account already exists in PostgreSQL (idempotent restart).
		var ua models.UserAccount
		result := db.Where("account_number = ?", sa.AccountNumber).First(&ua)
		if result.Error != nil {
			// Create in PostgreSQL
			ua = models.UserAccount{
				UserID:        userID,
				AccountNumber: sa.AccountNumber,
				AccountType:   sa.AccountType,
				Currency:      sa.Currency,
			}
			if err := db.Create(&ua).Error; err != nil {
				log.Printf("Error creating account %s: %v", sa.AccountNumber, err)
				continue
			}
			// Use auto-increment ID as TigerBeetle ID
			ua.TBAccountID = uint64(ua.ID)
			db.Save(&ua)
		}

		accountMap[sa.AccountNumber] = ua.TBAccountID

		// Create normal (non-imported) account in TigerBeetle.
		if err := tb.CreateAccount(ua.TBAccountID, sa.AccountType); err != nil {
			log.Printf("Error creating TB account %d: %v", ua.TBAccountID, err)
			continue
		}

		if (i+1)%200 == 0 {
			log.Printf("  Created %d/%d accounts", i+1, len(seed.Accounts))
		}
	}
	log.Printf("Created %d accounts", len(seed.Accounts))

	// Step 4: Seed initial balances as regular deposits from the operator account.
	log.Println("Importing initial balances...")
	transferID := uint64(1)

	for _, sa := range seed.Accounts {
		if sa.InitialBalance <= 0 {
			continue
		}
		tbID, ok := accountMap[sa.AccountNumber]
		if !ok {
			continue
		}

		amountCents := tbclient.DollarsToCents(sa.InitialBalance)
		if err := tb.CreateTransfer(transferID, tbclient.OperatorAccountID, tbID, amountCents, tbclient.TransferCodeDeposit); err != nil {
			log.Printf("Error seeding balance for %s: %v", sa.AccountNumber, err)
		}
		transferID++
	}
	log.Printf("Seeded initial balances for %d accounts", len(seed.Accounts))

	// Step 5: Seed historical transactions as regular transfers.
	log.Println("Seeding transactions...")

	// Sort transactions by timestamp so credits tend to arrive before debits.
	sort.Slice(seed.Transactions, func(i, j int) bool {
		return seed.Transactions[i].Timestamp < seed.Transactions[j].Timestamp
	})

	imported := 0
	skipped := 0
	for i, st := range seed.Transactions {
		if st.Status != "completed" {
			skipped++
			continue
		}

		var debitID, creditID uint64
		var code uint16

		switch st.Type {
		case "deposit":
			// from EXTERNAL to user account
			tbID, ok := accountMap[st.ToAccount]
			if !ok {
				skipped++
				continue
			}
			debitID = tbclient.OperatorAccountID
			creditID = tbID
			code = tbclient.TransferCodeDeposit

		case "withdrawal":
			// from user account to EXTERNAL
			tbID, ok := accountMap[st.FromAccount]
			if !ok {
				skipped++
				continue
			}
			debitID = tbID
			creditID = tbclient.OperatorAccountID
			code = tbclient.TransferCodeWithdrawal

		case "transfer", "internal_transfer":
			fromTB, ok1 := accountMap[st.FromAccount]
			toTB, ok2 := accountMap[st.ToAccount]
			if !ok1 || !ok2 {
				skipped++
				continue
			}
			debitID = fromTB
			creditID = toTB
			code = tbclient.TransferCodeTransfer

		default:
			skipped++
			continue
		}

		amountCents := tbclient.DollarsToCents(st.Amount)

		if err := tb.CreateTransfer(transferID, debitID, creditID, amountCents, code); err != nil {
			// ExceedsDebits (code 55) = account has insufficient seeded balance.
			// Silently skip — this can happen with historical data ordering.
			if imported%500 == 0 {
				log.Printf("Transfer seed error (sample): %v", err)
			}
			skipped++
		} else {
			imported++
		}
		transferID++

		if (i+1)%1000 == 0 {
			log.Printf("  Processed %d/%d transactions (imported: %d, skipped: %d)",
				i+1, len(seed.Transactions), imported, skipped)
		}
	}
	log.Printf("Seeded %d transactions, skipped %d", imported, skipped)

	log.Println("Seed complete!")
	return nil
}

func findSeedFile() string {
	paths := []string{
		"/data/seed.json",
		"./datos-prueba-HNL (1).json",
		"../datos-prueba-HNL (1).json",
		"/app/data/seed.json",
	}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}
