package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/henry/banca-online/internal/middleware"
)

// writeJSON writes a JSON response
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// getUserIDFromCtx extracts user ID from request context
func getUserIDFromCtx(r *http.Request) uuid.UUID {
	return middleware.GetUserID(r.Context())
}
