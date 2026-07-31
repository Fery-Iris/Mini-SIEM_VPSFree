package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/FamilyJewelsRuined/mini-siem-be/database"
	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
	"golang.org/x/crypto/bcrypt"
)

// HandleRegister creates a new organization + admin entry in one step.
// Every registered user becomes an admin with their own data scope.
//
// POST /api/auth/register
//
// Request:
//
//	{ "organizationName": "PT Contoh", "email": "user@example.com", "password": "secret123" }
//
// Response (201):
//
//	{ "success": true, "adminId": 5, "email": "...", "organizationId": 2, "organizationName": "..." }
func HandleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var body struct {
		OrganizationName string `json:"organizationName"`
		Email            string `json:"email"`
		Password         string `json:"password"`
	}
	if err := helpers.ReadJSON(r, &body); err != nil {
		helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	// Validation
	body.OrganizationName = strings.TrimSpace(body.OrganizationName)
	body.Email = strings.TrimSpace(body.Email)

	if body.OrganizationName == "" {
		helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "organizationName is required"})
		return
	}
	if body.Email == "" || !strings.Contains(body.Email, "@") {
		helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "valid email is required"})
		return
	}
	if len(body.Password) < 8 {
		helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 8 characters"})
		return
	}

	// Check if email already exists in admins
	var exists int
	database.DB.QueryRow("SELECT COUNT(*) FROM admins WHERE email = ?", body.Email).Scan(&exists)
	if exists > 0 {
		helpers.WriteJSON(w, http.StatusConflict, map[string]string{"error": "email already registered"})
		return
	}

	// 1. Create organization
	orgResult, err := database.DB.Exec(
		"INSERT INTO organizations (name) VALUES (?)",
		body.OrganizationName,
	)
	if err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create organization"})
		return
	}
	orgID, _ := orgResult.LastInsertId()

	// 2. Create admin entry (with hashed password + org link)
	hashed, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
		return
	}

	b := make([]byte, 16)
	rand.Read(b)
	verificationToken := hex.EncodeToString(b)

	adminResult, err := database.DB.Exec(
		"INSERT INTO admins (email, password, organization_id, verification_token) VALUES (?, ?, ?, ?)",
		body.Email, string(hashed), orgID, verificationToken,
	)
	if err != nil {
		// Rollback org on failure
		database.DB.Exec("DELETE FROM organizations WHERE id = ?", orgID)
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create admin account"})
		return
	}
	adminID, _ := adminResult.LastInsertId()

	// 3. Send Welcome Email via Resend with verification link
	if body.Email != "admin@xrsecurity.com" {
		go func(email, token string) {
			baseURL := os.Getenv("BASE_URL")
			if baseURL == "" {
				baseURL = "http://localhost:8081"
			}
			verificationLink := baseURL + "/api/auth/verify?token=" + token
			err := helpers.SendWelcomeEmail(email, verificationLink)
			if err != nil {
				log.Printf("⚠️ Failed to send welcome email to %s: %v", email, err)
			} else {
				log.Printf("📧 Welcome email sent to %s via Resend", email)
			}
		}(body.Email, verificationToken)
	} else {
		log.Printf("📧 Skipped sending welcome email to %s (testing account)", body.Email)
	}

	helpers.WriteJSON(w, http.StatusCreated, map[string]any{
		"success":          true,
		"adminId":          adminID,
		"email":            body.Email,
		"organizationId":   orgID,
		"organizationName": body.OrganizationName,
		"message":          "Please check your email to verify your account.",
	})
}
