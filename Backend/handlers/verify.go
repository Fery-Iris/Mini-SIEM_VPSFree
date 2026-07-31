package handlers

import (
	"net/http"

	"github.com/FamilyJewelsRuined/mini-siem-be/database"
)

// HandleVerifyEmail verifies a newly registered user's email via token.
// GET /api/auth/verify?token=XYZ
func HandleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	token := r.URL.Query().Get("token")
	if token == "" {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`<html><body><h2>Error</h2><p>Missing verification token.</p></body></html>`))
		return
	}

	res, err := database.DB.Exec("UPDATE admins SET is_verified = TRUE, verification_token = NULL WHERE verification_token = ?", token)
	if err != nil {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`<html><body><h2>Error</h2><p>Database error.</p></body></html>`))
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`<html><body><h2>Error</h2><p>Invalid or expired token.</p></body></html>`))
		return
	}

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(`<html><body><h2>Email Verified Successfully!</h2><p>You can now close this tab and return to the application to log in.</p></body></html>`))
}
