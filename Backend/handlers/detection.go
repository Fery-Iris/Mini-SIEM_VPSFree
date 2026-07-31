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

// HandleDetectionThreats returns the current threat list, excluding blocked IPs.
// GET /api/detection/threats
func HandleDetectionThreats(store *models.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		store.Mu.RLock()
		defer store.Mu.RUnlock()

		// Build a set of blocked IPs for fast lookup
		blockedSet := make(map[string]bool, len(store.BlockedIPs))
		for _, b := range store.BlockedIPs {
			blockedSet[b.IP] = true
		}

		adminID := middleware.GetAdminID(r)

		// Filter out threats whose IP is in the blocked set AND filter by admin_id if provided
		// Deduplicate so each IP appears only once (latest threat first)
		filtered := make([]models.ThreatRow, 0, len(store.Threats))
		seenIPs := make(map[string]bool)
		for _, t := range store.Threats {
			if adminID != "" && t.AdminID != adminID {
				continue
			}
			if !blockedSet[t.SourceIP] && !seenIPs[t.SourceIP] {
				seenIPs[t.SourceIP] = true
				filtered = append(filtered, t)
			}
		}

		helpers.WriteJSON(w, http.StatusOK, map[string]any{"threats": filtered})
	}
}

// HandleBlockIP adds an IP to the blocked list, removes it from threats, and updates DB.
// POST /api/detection/block
func HandleBlockIP(store *models.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			helpers.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		var body struct {
			IP string `json:"ip"`
		}
		if err := helpers.ReadJSON(r, &body); err != nil || body.IP == "" {
			helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "ip is required"})
			return
		}

		// admin_id comes from JWT context, not from the request body
		adminID := middleware.GetAdminID(r)

		// Update database: mark all rows with this IP as blocked for this admin
		_, dbErr := database.DB.Exec(
			"UPDATE security_logs SET is_blocked = 1 WHERE ip_address = ? AND admin_id = ? AND is_blocked = 0",
			body.IP, adminID,
		)
		if dbErr != nil {
			log.Printf("⚠️  HandleBlockIP DB update error: %v", dbErr)
		}

		store.Mu.Lock()
		defer store.Mu.Unlock()

		// Check if already blocked to avoid duplicates
		alreadyBlocked := false
		for _, b := range store.BlockedIPs {
			if b.IP == body.IP && b.AdminID == adminID {
				alreadyBlocked = true
				break
			}
		}

		blockedAt := time.Now().Format("15:04")
		if !alreadyBlocked {
			blocked := models.BlockedIP{AdminID: adminID, IP: body.IP, BlockedAt: blockedAt}
			store.BlockedIPs = append([]models.BlockedIP{blocked}, store.BlockedIPs...)
		}

		// Remove this IP from the threats list for this admin
		newThreats := make([]models.ThreatRow, 0, len(store.Threats))
		for _, t := range store.Threats {
			if t.SourceIP == body.IP && t.AdminID == adminID {
				continue
			}
			newThreats = append(newThreats, t)
		}
		store.Threats = newThreats

		helpers.WriteJSON(w, http.StatusOK, map[string]any{
			"message": fmt.Sprintf("IP %s blocked", body.IP),
			"blocked": models.BlockedIP{IP: body.IP, BlockedAt: blockedAt},
		})
	}
}
