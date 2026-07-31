package handlers

import (
	"net/http"
	"time"

	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
)

// HandleHealth responds with server health status.
// GET /api/health
func HandleHealth(w http.ResponseWriter, r *http.Request) {
	helpers.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "time": time.Now().Format(time.RFC3339)})
}
