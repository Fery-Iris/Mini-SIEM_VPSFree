package handlers

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/FamilyJewelsRuined/mini-siem-be/database"
	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
	"github.com/FamilyJewelsRuined/mini-siem-be/middleware"
	"golang.org/x/crypto/bcrypt"
)

// HandleLogin authenticates an admin user and returns a JWT token.
// POST /api/auth/login
// Returns token + adminId + organization info for frontend data scoping.
func HandleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := helpers.ReadJSON(r, &body); err != nil {
		helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	var adminID int
	var dbPassword string
	var orgID sql.NullInt64
	var isVerified bool

	err := database.DB.QueryRow(
		"SELECT id, password, organization_id, is_verified FROM admins WHERE email = ?",
		body.Email,
	).Scan(&adminID, &dbPassword, &orgID, &isVerified)

	if err == sql.ErrNoRows {
		helpers.WriteJSON(w, http.StatusUnauthorized, map[string]any{"success": false, "message": "Invalid credentials"})
		return
	} else if err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(dbPassword), []byte(body.Password)); err != nil {
		helpers.WriteJSON(w, http.StatusUnauthorized, map[string]any{"success": false, "message": "Invalid password"})
		return
	}

	if !isVerified {
		helpers.WriteJSON(w, http.StatusForbidden, map[string]any{"success": false, "message": "Email belum diverifikasi. Silakan periksa kotak masuk email Anda."})
		return
	}

	// Fetch organization name if linked
	orgIDVal := 0
	orgName := ""
	if orgID.Valid {
		orgIDVal = int(orgID.Int64)
		database.DB.QueryRow("SELECT name FROM organizations WHERE id = ?", orgIDVal).Scan(&orgName)
	}

	// Generate JWT token containing admin_id
	token, err := middleware.GenerateJWT(adminID)
	if err != nil {
		log.Printf("⚠️  JWT generation failed for admin %d: %v", adminID, err)
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate auth token"})
		return
	}

	helpers.WriteJSON(w, http.StatusOK, map[string]any{
		"success":          true,
		"token":            token,
		"email":            body.Email,
		"adminId":          adminID,
		"organizationId":   orgIDVal,
		"organizationName": orgName,
	})
}


