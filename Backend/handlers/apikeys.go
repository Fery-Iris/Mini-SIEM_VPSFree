package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/FamilyJewelsRuined/mini-siem-be/database"
	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
	"github.com/FamilyJewelsRuined/mini-siem-be/middleware"
	"github.com/FamilyJewelsRuined/mini-siem-be/models"
)

// HandleGetAPIKeys returns API keys filtered by admin_id from JWT.
// GET /api/apikeys  (admin_id extracted from JWT)
func HandleGetAPIKeys(w http.ResponseWriter, r *http.Request) {
	adminID := middleware.GetAdminID(r)

	var keys []models.APIKeyEntry

	query := `
		SELECT Id, Admin_id, Key_value, Is_active, DATE_FORMAT(Created_at, '%M %d, %Y') as created
		FROM api_keys`
	var args []any
	if adminID != "" {
		query += " WHERE Admin_id = ?"
		args = append(args, adminID)
	}
	query += " ORDER BY Created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var k models.APIKeyEntry
		if err := rows.Scan(&k.ID, &k.AdminID, &k.KeyValue, &k.IsActive, &k.CreatedAt); err != nil {
			log.Printf("scan error api_keys: %v", err)
			continue
		}
		keys = append(keys, k)
	}

	helpers.WriteJSON(w, http.StatusOK, map[string]any{"keys": keys})
}

// HandleGenerateAPIKey creates a new API key scoped to the authenticated admin.
// POST /api/apikeys/generate  (admin_id extracted from JWT)
func HandleGenerateAPIKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		helpers.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	// admin_id comes from JWT — no longer from request body
	adminIDStr := middleware.GetAdminID(r)
	adminID := 1 // fallback
	if adminIDStr != "" {
		fmt.Sscanf(adminIDStr, "%d", &adminID)
	}

	newKey := helpers.GenerateAPIKey()
	isActive := 1

	res, err := database.DB.Exec(`
		INSERT INTO api_keys (Admin_id, Key_value, Is_active)
		VALUES (?, ?, ?)`,
		adminID, newKey, isActive,
	)
	if err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	id, _ := res.LastInsertId()
	entry := models.APIKeyEntry{
		ID:        int(id),
		AdminID:   adminID,
		KeyValue:  newKey,
		IsActive:  isActive,
		CreatedAt: time.Now().Format("January 2, 2006"),
	}

	helpers.WriteJSON(w, http.StatusCreated, map[string]any{"message": "API key generated", "key": entry})
}

// HandleDeleteAPIKey removes an API key by ID, scoped to the authenticated admin.
// DELETE /api/apikeys/delete?id=X  (admin_id extracted from JWT)
func HandleDeleteAPIKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		helpers.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "missing id parameter"})
		return
	}

	// Always enforce admin_id ownership via JWT
	adminID := middleware.GetAdminID(r)
	var result interface{ RowsAffected() (int64, error) }
	var err error
	if adminID != "" {
		result, err = database.DB.Exec("DELETE FROM api_keys WHERE Id = ? AND Admin_id = ?", idStr, adminID)
	} else {
		result, err = database.DB.Exec("DELETE FROM api_keys WHERE Id = ?", idStr)
	}

	if err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		helpers.WriteJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("API key not found (id=%s)", idStr)})
		return
	}

	helpers.WriteJSON(w, http.StatusOK, map[string]string{"message": "API key deleted"})
}

