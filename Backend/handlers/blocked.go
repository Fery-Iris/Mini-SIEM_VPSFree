package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os/exec"

	"github.com/FamilyJewelsRuined/mini-siem-be/crowdsec"
	"github.com/FamilyJewelsRuined/mini-siem-be/database"
	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
	"github.com/FamilyJewelsRuined/mini-siem-be/middleware"
	"github.com/FamilyJewelsRuined/mini-siem-be/models"
)

// HandleGetBlocked returns the list of blocked IPs.
// GET /api/blocked
func HandleGetBlocked(store *models.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		store.Mu.RLock()
		defer store.Mu.RUnlock()
		adminID := middleware.GetAdminID(r)
		
		filtered := make([]models.BlockedIP, 0, len(store.BlockedIPs))
		for _, b := range store.BlockedIPs {
			if adminID != "" && b.AdminID != adminID {
				continue
			}
			filtered = append(filtered, b)
		}
		
		helpers.WriteJSON(w, http.StatusOK, map[string]any{"blocked": filtered})
	}
}

// HandleUnblockIP removes an IP from the blocked list, restores it to threats, and updates DB.
// POST /api/blocked/unblock
func HandleUnblockIP(store *models.Store, cb crowdsec.WebhookCallbacks) http.HandlerFunc {
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

		// admin_id comes from JWT context
		adminID := middleware.GetAdminID(r)

		// Update database: mark all rows with this IP as unblocked for this admin
		_, dbErr := database.DB.Exec(
			"UPDATE security_logs SET is_blocked = 0 WHERE ip_address = ? AND admin_id = ? AND is_blocked = 1",
			body.IP, adminID,
		)
		if dbErr != nil {
			log.Printf("⚠️  HandleUnblockIP DB update error: %v", dbErr)
		}

		// Tell Windows Firewall (CrowdSec) to UNBLOCK the IP natively
		unblockCmd := exec.Command("cscli", "decisions", "delete", "-i", body.IP)
		if unblockErr := unblockCmd.Run(); unblockErr != nil {
			log.Printf("⚠️ Firewall Unban Failed for %s: %v", body.IP, unblockErr)
		} else {
			log.Printf("✅ Windows Firewall Bouncer instructed to UNBLOCK %s", body.IP)
		}

		// Reset LogWatcher internal cooldowns so this IP can be re-detected
		// if it attacks again — unblock is a temporary reprieve, not a permanent exemption.
		if cb.ClearBan != nil {
			cb.ClearBan(body.IP)
		}

		// Re-query database for this IP's threat entries to restore to in-memory Threats
		restoredThreats := []models.ThreatRow{}
		rows, err := database.DB.Query(`
			SELECT action, severity, created_at, COALESCE(ip_address_public, '')
			FROM security_logs
			WHERE ip_address = ? AND admin_id = ? AND source = 'crowdsec'
			ORDER BY id DESC
		`, body.IP, adminID)
		if err != nil {
			log.Printf("⚠️  HandleUnblockIP restore query error: %v", err)
		} else {
			defer rows.Close()
			for rows.Next() {
				var action, severity, createdAt, publicIP string
				if err := rows.Scan(&action, &severity, &createdAt, &publicIP); err != nil {
					log.Printf("⚠️  HandleUnblockIP scan error: %v", err)
					continue
				}
				label := mapActionToLabel(action)
				// Use public IP for GeoIP, fall back to private IP
				geoTarget := publicIP
				if geoTarget == "" {
					geoTarget = body.IP
				}
				geo := helpers.LookupGeoIP(geoTarget)
				restoredThreats = append(restoredThreats, models.ThreatRow{
					AdminID:      adminID,
					AttackType:   label,
					SourceIP:     body.IP,
					PublicIP:     publicIP,
					Severity:     severity,
					LatestUpdate: fmt.Sprintf("Detected %s", extractTime(createdAt)),
					CountryCode:  geo.CountryCode,
					Country:      geo.Country,
					Lat:          geo.Lat,
					Lng:          geo.Lng,
				})
			}
		}

		store.Mu.Lock()
		defer store.Mu.Unlock()

		// Remove from blocked list
		found := false
		newList := make([]models.BlockedIP, 0, len(store.BlockedIPs))
		for _, b := range store.BlockedIPs {
			if b.IP == body.IP && b.AdminID == adminID && !found {
				found = true
				continue
			}
			newList = append(newList, b)
		}
		store.BlockedIPs = newList

		if !found {
			helpers.WriteJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("IP %s not in blocked list", body.IP)})
			return
		}

		// Restore threats — prepend restored entries to in-memory Threats
		if len(restoredThreats) > 0 {
			store.Threats = append(restoredThreats, store.Threats...)
		}

		helpers.WriteJSON(w, http.StatusOK, map[string]any{
			"message":  fmt.Sprintf("IP %s unblocked", body.IP),
			"restored": len(restoredThreats),
		})
	}
}

// mapActionToLabel converts a DB action string to a display label.
func mapActionToLabel(action string) string {
	labels := map[string]string{
		"XSS_Attempt":       "XSS (CrowdSec)",
		"Brute_Force":       "Brute Force (CrowdSec)",
		"SQL_Injection":     "SQL Injection (CrowdSec)",
		"File_Inclusion":    "File Inclusion (CrowdSec)",
		"Command_Injection": "Command Injection (CrowdSec)",
		"Unknown_Attack":    "Unknown (CrowdSec)",
	}
	if l, ok := labels[action]; ok {
		return l
	}
	return action
}

// extractTime pulls HH:MM from a datetime string like "2006-01-02 15:04:05".
func extractTime(datetime string) string {
	if len(datetime) >= 16 {
		return datetime[11:16]
	}
	return datetime
}
