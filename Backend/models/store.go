package models

import (
	"database/sql"
	"fmt"
	"log"
	"sync"
	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
)

// Store holds in-memory data for threats & blocked IPs.
type Store struct {
	Mu         sync.RWMutex
	Threats    []ThreatRow
	BlockedIPs []BlockedIP
	APIKeys    []APIKeyEntry
	NextKeyID  int
}

// NewStore creates an empty store (no dummy data).
func NewStore() *Store {
	return &Store{
		NextKeyID:  2,
		Threats:    []ThreatRow{},
		BlockedIPs: []BlockedIP{},
		APIKeys:    []APIKeyEntry{},
	}
}

// LoadFromDB hydrates the in-memory store from the security_logs table.
// This is called once at startup so the dashboard reflects historical CrowdSec data.
func (s *Store) LoadFromDB(db *sql.DB) {
	s.Mu.Lock()
	defer s.Mu.Unlock()

	// ── Load Threats from security_logs (CrowdSec source) ──
	rows, err := db.Query(`
		SELECT COALESCE(admin_id, ''), action, ip_address, COALESCE(ip_address_public, ''), severity, created_at, is_blocked
		FROM security_logs
		WHERE source = 'crowdsec'
		ORDER BY id DESC
		LIMIT 100
	`)
	if err != nil {
		log.Printf("⚠️  Store.LoadFromDB threats query error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var adminID, action, ip, publicIP, severity, createdAt string
		var isBlocked int
		if err := rows.Scan(&adminID, &action, &ip, &publicIP, &severity, &createdAt, &isBlocked); err != nil {
			log.Printf("⚠️  Store.LoadFromDB scan error: %v", err)
			continue
		}
		// Map DB action to human-readable label
		label := mapActionToLabel(action)
		// Use public IP for GeoIP (globe), fall back to private IP
		geoTarget := publicIP
		if geoTarget == "" {
			geoTarget = ip
		}
		geo := helpers.LookupGeoIP(geoTarget)
		s.Threats = append(s.Threats, ThreatRow{
			AdminID:      adminID,
			AttackType:   label,
			SourceIP:     ip,
			PublicIP:     publicIP,
			Severity:     severity,
			LatestUpdate: fmt.Sprintf("Detected %s", extractTime(createdAt)),
			CountryCode:  geo.CountryCode,
			Country:      geo.Country,
			Lat:          geo.Lat,
			Lng:          geo.Lng,
		})
		// Also populate blocked list for entries that were blocked
		if isBlocked == 1 {
			s.BlockedIPs = append(s.BlockedIPs, BlockedIP{
				AdminID:   adminID,
				IP:        ip,
				BlockedAt: extractTime(createdAt),
			})
		}
	}

	log.Printf("📦 Store hydrated from DB: %d threats, %d blocked IPs", len(s.Threats), len(s.BlockedIPs))
}

// mapActionToLabel converts a DB action string (e.g. "XSS_Attempt") to a display label.
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
