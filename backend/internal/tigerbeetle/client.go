package tigerbeetle

import (
	"encoding/binary"
	"fmt"
	"log"
	"net"
	"time"

	tb "github.com/tigerbeetle/tigerbeetle-go"
	tb_types "github.com/tigerbeetle/tigerbeetle-go/pkg/types"
)

const (
	LedgerUSD = 1

	CodeChecking   = 1
	CodeSavings    = 2
	CodeInvestment = 3
	CodeOperator   = 99

	TransferCodeTransfer   = 1
	TransferCodeDeposit    = 2
	TransferCodeWithdrawal = 3

	// OperatorAccountID is the bank's internal account for deposits/withdrawals
	OperatorAccountID = 999_999
)

// Client wraps the TigerBeetle Go client
type Client struct {
	client tb.Client
}

// NewClient creates a new TigerBeetle client with retry
func NewClient(address string) (*Client, error) {
	var client tb.Client
	var err error

	for i := 0; i < 30; i++ {
		// TigerBeetle client requires numeric IP addresses, not hostnames.
		// Resolve DNS hostname to IP for Docker networking compatibility.
		resolved := resolveAddress(address)
		client, err = tb.NewClient(tb_types.ToUint128(0), []string{resolved})
		if err == nil {
			break
		}
		log.Printf("Waiting for TigerBeetle... attempt %d/30: %v (address: %s)", i+1, err, resolved)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to connect to TigerBeetle after 30 attempts: %w", err)
	}

	return &Client{client: client}, nil
}

// resolveAddress resolves a hostname:port to IP:port for TigerBeetle client compatibility
func resolveAddress(address string) string {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return address
	}
	// If already an IP, return as-is
	if ip := net.ParseIP(host); ip != nil {
		return address
	}
	// Resolve hostname to IP
	ips, err := net.LookupHost(host)
	if err != nil || len(ips) == 0 {
		return address // fallback to original
	}
	resolved := net.JoinHostPort(ips[0], port)
	log.Printf("Resolved TigerBeetle address: %s -> %s", address, resolved)
	return resolved
}

// Close closes the TigerBeetle client
func (c *Client) Close() {
	c.client.Close()
}

// AccountTypeToCode maps account type string to TigerBeetle code
func AccountTypeToCode(accountType string) uint16 {
	switch accountType {
	case "checking":
		return CodeChecking
	case "savings":
		return CodeSavings
	case "investment":
		return CodeInvestment
	default:
		return CodeChecking
	}
}

// CodeToAccountType maps TigerBeetle code to account type string
func CodeToAccountType(code uint16) string {
	switch code {
	case CodeChecking:
		return "checking"
	case CodeSavings:
		return "savings"
	case CodeInvestment:
		return "investment"
	case CodeOperator:
		return "operator"
	default:
		return "unknown"
	}
}

// CreateOperatorAccount creates the bank operator account (for deposits/withdrawals).
func (c *Client) CreateOperatorAccount() error {
	accounts := []tb_types.Account{
		{
			ID:     tb_types.ToUint128(OperatorAccountID),
			Ledger: LedgerUSD,
			Code:   CodeOperator,
			Flags: tb_types.AccountFlags{
				History: true,
			}.ToUint16(),
		},
	}

	results, err := c.client.CreateAccounts(accounts)
	if err != nil {
		return fmt.Errorf("creating operator account: %w", err)
	}
	for _, r := range results {
		if r.Result != tb_types.AccountOK && r.Result != tb_types.AccountExists {
			return fmt.Errorf("failed to create operator account: result code %d", r.Result)
		}
	}
	return nil
}

// CreateAccount creates a new account in TigerBeetle.
func (c *Client) CreateAccount(id uint64, accountType string) error {
	accounts := []tb_types.Account{
		{
			ID:     tb_types.ToUint128(id),
			Ledger: LedgerUSD,
			Code:   AccountTypeToCode(accountType),
			Flags: tb_types.AccountFlags{
				DebitsMustNotExceedCredits: true,
				History:                   true,
			}.ToUint16(),
		},
	}

	results, err := c.client.CreateAccounts(accounts)
	if err != nil {
		return fmt.Errorf("creating account %d: %w", id, err)
	}
	for _, r := range results {
		if r.Result != tb_types.AccountOK && r.Result != tb_types.AccountExists {
			return fmt.Errorf("failed to create account %d: result code %d", id, r.Result)
		}
	}
	return nil
}

// CreateImportedTransfer creates a transfer with imported flag (for seeding historical data)
func (c *Client) CreateImportedTransfer(id uint64, debitID, creditID uint64, amountCents uint64, code uint16, timestamp uint64) error {
	transfers := []tb_types.Transfer{
		{
			ID:              tb_types.ToUint128(id),
			DebitAccountID:  tb_types.ToUint128(debitID),
			CreditAccountID: tb_types.ToUint128(creditID),
			Amount:          tb_types.ToUint128(amountCents),
			Ledger:          LedgerUSD,
			Code:            code,
			Flags: tb_types.TransferFlags{
				Imported: true,
			}.ToUint16(),
			Timestamp: timestamp,
		},
	}

	results, err := c.client.CreateTransfers(transfers)
	if err != nil {
		return fmt.Errorf("creating imported transfer %d: %w", id, err)
	}
	for _, r := range results {
		// Accept OK and all "exists" variants — transfer already imported on a previous run.
		switch r.Result {
		case tb_types.TransferOK,
			tb_types.TransferExists,
			tb_types.TransferExistsWithDifferentFlags,
			tb_types.TransferExistsWithDifferentDebitAccountID,
			tb_types.TransferExistsWithDifferentCreditAccountID,
			tb_types.TransferExistsWithDifferentAmount,
			tb_types.TransferExistsWithDifferentUserData128,
			tb_types.TransferExistsWithDifferentUserData64,
			tb_types.TransferExistsWithDifferentUserData32,
			tb_types.TransferExistsWithDifferentCode:
			// Already exists or created — both are fine.
		default:
			return fmt.Errorf("failed to create imported transfer %d: result code %d", id, r.Result)
		}
	}
	return nil
}

// CreateTransfer creates a new transfer in TigerBeetle
func (c *Client) CreateTransfer(id uint64, debitID, creditID uint64, amountCents uint64, code uint16) error {
	transfers := []tb_types.Transfer{
		{
			ID:              tb_types.ToUint128(id),
			DebitAccountID:  tb_types.ToUint128(debitID),
			CreditAccountID: tb_types.ToUint128(creditID),
			Amount:          tb_types.ToUint128(amountCents),
			Ledger:          LedgerUSD,
			Code:            code,
		},
	}

	results, err := c.client.CreateTransfers(transfers)
	if err != nil {
		return fmt.Errorf("creating transfer: %w", err)
	}
	for _, r := range results {
		if r.Result != tb_types.TransferOK && r.Result != tb_types.TransferExists {
			return fmt.Errorf("failed to create transfer: result code %d (%s)", r.Result, r.Result)
		}
	}
	return nil
}

// GetAccountBalance returns the balance (credits - debits) in cents for a credit-balance account
func (c *Client) GetAccountBalance(id uint64) (uint64, error) {
	accounts, err := c.client.LookupAccounts([]tb_types.Uint128{tb_types.ToUint128(id)})
	if err != nil {
		return 0, fmt.Errorf("looking up account %d: %w", id, err)
	}
	if len(accounts) == 0 {
		return 0, fmt.Errorf("account %d not found", id)
	}

	acc := accounts[0]
	credits := uint128ToUint64(acc.CreditsPosted)
	debits := uint128ToUint64(acc.DebitsPosted)

	if credits < debits {
		return 0, nil
	}
	return credits - debits, nil
}

// GetAccountTransfers returns transfers for an account, ordered by timestamp desc
func (c *Client) GetAccountTransfers(id uint64, limit uint32) ([]tb_types.Transfer, error) {
	filter := tb_types.AccountFilter{
		AccountID:    tb_types.ToUint128(id),
		TimestampMin: 0,
		TimestampMax: 0, // 0 means no upper bound
		Limit:        limit,
		Flags: tb_types.AccountFilterFlags{
			Credits:  true,
			Debits:   true,
			Reversed: true, // newest first
		}.ToUint32(),
	}

	transfers, err := c.client.GetAccountTransfers(filter)
	if err != nil {
		return nil, fmt.Errorf("getting transfers for account %d: %w", id, err)
	}
	return transfers, nil
}

// CloseImportedAccount closes the imported state of an account so it can
// accept non-imported transfers. Call with a timestamp that is strictly
// greater than the last imported transfer that touches this account.
func (c *Client) CloseImportedAccount(id uint64, code uint16, timestamp uint64, creditAccount bool) error {
	flags := tb_types.AccountFlags{
		Imported: true,
		Closed:   true,
		History:  true,
	}
	if creditAccount {
		flags.DebitsMustNotExceedCredits = true
	}

	accounts := []tb_types.Account{
		{
			ID:        tb_types.ToUint128(id),
			Ledger:    LedgerUSD,
			Code:      code,
			Flags:     flags.ToUint16(),
			Timestamp: timestamp,
		},
	}

	results, err := c.client.CreateAccounts(accounts)
	if err != nil {
		return fmt.Errorf("closing imported account %d: %w", id, err)
	}
	for _, r := range results {
		switch r.Result {
		case tb_types.AccountOK, tb_types.AccountExists,
			tb_types.AccountExistsWithDifferentFlags,
			tb_types.AccountImportedEventNotExpected:
			// OK, already closed, or not in imported state — all fine.
		default:
			return fmt.Errorf("failed to close imported account %d: result code %d", id, r.Result)
		}
	}
	return nil
}

// DollarsToCents converts a dollar amount to cents
func DollarsToCents(amount float64) uint64 {
	return uint64(amount*100 + 0.5)
}

// CentsToDollars converts cents to dollar amount
func CentsToDollars(cents uint64) float64 {
	return float64(cents) / 100.0
}

// uint128ToUint64 extracts the lower 64 bits from a u128
func uint128ToUint64(val tb_types.Uint128) uint64 {
	return binary.LittleEndian.Uint64(val[:8])
}

// Uint128ToUint64 is the exported version
func Uint128ToUint64(val tb_types.Uint128) uint64 {
	return uint128ToUint64(val)
}
