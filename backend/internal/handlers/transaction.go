package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/henry/banca-online/internal/models"
	"github.com/henry/banca-online/internal/services"
)

type TransactionHandler struct {
	txnSvc *services.TransactionService
}

func NewTransactionHandler(txnSvc *services.TransactionService) *TransactionHandler {
	return &TransactionHandler{txnSvc: txnSvc}
}

// Deposit POST /api/transactions/deposit
func (h *TransactionHandler) Deposit(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromCtx(r)

	var req models.DepositRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.AccountNumber == "" || req.Amount <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "account_number and positive amount required"})
		return
	}

	resp, err := h.txnSvc.Deposit(userID, req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// Withdraw POST /api/transactions/withdraw
func (h *TransactionHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromCtx(r)

	var req models.WithdrawRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.AccountNumber == "" || req.Amount <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "account_number and positive amount required"})
		return
	}

	resp, err := h.txnSvc.Withdraw(userID, req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// Transfer POST /api/transactions/transfer
func (h *TransactionHandler) Transfer(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromCtx(r)

	var req models.TransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.FromAccount == "" || req.ToAccount == "" || req.Amount <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "from_account, to_account, and positive amount required"})
		return
	}

	resp, err := h.txnSvc.Transfer(userID, req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// History GET /api/transactions?page=1&limit=20
func (h *TransactionHandler) History(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromCtx(r)

	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}

	transactions, err := h.txnSvc.GetTransactionHistory(userID, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if transactions == nil {
		transactions = []models.TransactionResponse{}
	}

	writeJSON(w, http.StatusOK, transactions)
}
