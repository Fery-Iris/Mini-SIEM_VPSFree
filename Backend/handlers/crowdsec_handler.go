package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/FamilyJewelsRuined/mini-siem-be/crowdsec"
	"github.com/FamilyJewelsRuined/mini-siem-be/database"
	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
	"github.com/FamilyJewelsRuined/mini-siem-be/middleware"
)

// HandleCrowdSecStatus returns CrowdSec connection status.
// GET /api/crowdsec/status
func HandleCrowdSecStatus(csClient *crowdsec.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		connected := csClient.IsConnected()

		// Scope alert count to the authenticated admin
		adminID := middleware.GetAdminID(r)
		var crowdsecAlertCount int
		if adminID != "" {
			database.DB.QueryRow(
				"SELECT COUNT(*) FROM security_logs WHERE source = 'crowdsec' AND admin_id = ?",
				adminID,
			).Scan(&crowdsecAlertCount)
		} else {
			database.DB.QueryRow("SELECT COUNT(*) FROM security_logs WHERE source = 'crowdsec'").Scan(&crowdsecAlertCount)
		}

		helpers.WriteJSON(w, http.StatusOK, map[string]any{
			"connected":     connected,
			"lapi_url":      csClient.Config().LAPIURL,
			"machine_id":    csClient.Config().MachineID,
			"alerts_stored": crowdsecAlertCount,
			"scenarios":     crowdsec.SupportedScenarios(),
		})
	}
}

// HandleCrowdSecWebhook receives notifications from CrowdSec HTTP plugin via API Key.
// Smart Webhook Mapping: looks up the API Key owner (admin_id) and routes alerts
// to the correct tenant's data scope.
//
// POST /api/alerts/webhook
// Authorization: Bearer xr_live_XYZ...
func HandleCrowdSecWebhook(cb crowdsec.WebhookCallbacks) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			helpers.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		// ── Step 1: Extract API Key from Authorization header ──
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing or invalid Authorization header"})
			return
		}
		apiKey := strings.TrimPrefix(authHeader, "Bearer ")

		// ── Step 2: Smart Mapping — "Hei Database, API Key ini milik siapa?" ──
		// Query both existence AND ownership in a single call.
		var ownerAdminID int
		err := database.DB.QueryRow(
			"SELECT Admin_id FROM api_keys WHERE Key_value = ? AND Is_active = 1",
			apiKey,
		).Scan(&ownerAdminID)

		if err != nil {
			// API key not found or inactive
			log.Printf("🚫 Webhook: rejected API key ...%s (not found / inactive)", safeKeySuffix(apiKey))
			helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or inactive API key"})
			return
		}

		adminIDStr := strconv.Itoa(ownerAdminID)
		log.Printf("🔑 Webhook Smart Mapping: API Key ...%s → Admin ID: %d",
			safeKeySuffix(apiKey), ownerAdminID)

		// ── Step 3: Parse alert payload ──
		var alerts []crowdsec.Alert
		if err := helpers.ReadJSON(r, &alerts); err != nil {
			helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body structure"})
			return
		}

		// ── Step 4: Process alerts with the resolved admin_id ──
		newCount := crowdsec.ProcessWebhookAlerts(alerts, cb, adminIDStr)
		helpers.WriteJSON(w, http.StatusOK, map[string]any{
			"status":    "success",
			"adminId":   ownerAdminID,
			"processed": len(alerts),
			"inserted":  newCount,
		})
	}
}

// safeKeySuffix returns the last 8 characters of an API key for safe logging.
func safeKeySuffix(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[len(key)-8:]
}

