package handlers

import (
	"net/http"

	"github.com/henry/banca-online/internal/services"
)

type AccountHandler struct {
	accountSvc *services.AccountService
}

func NewAccountHandler(accountSvc *services.AccountService) *AccountHandler {
	return &AccountHandler{accountSvc: accountSvc}
}

// ListAccounts GET /api/accounts
func (h *AccountHandler) ListAccounts(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromCtx(r)

	accounts, err := h.accountSvc.GetUserAccounts(userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, accounts)
}

// GetAccount GET /api/accounts/{accountNumber}
func (h *AccountHandler) GetAccount(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromCtx(r)
	accountNumber := r.PathValue("accountNumber")

	// Verify ownership
	if !h.accountSvc.UserOwnsAccount(userID, accountNumber) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "account does not belong to this user"})
		return
	}

	account, err := h.accountSvc.GetAccountWithBalance(accountNumber)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, account)
}
