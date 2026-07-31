package crowdsec

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
)

// ─────────────────────────── Scenario ↔ Action Mapping ───────────────────────────

// AttackType represents a supported attack category in the SIEM.
type AttackType struct {
	Action       string   // Action stored in security_logs, e.g. "XSS_Attempt"
	Label        string   // Human-readable label, e.g. "XSS (CrowdSec)"
	Scenarios    []string // CrowdSec scenario names that map to this type
	PatternFile  string   // Path to the pattern dictionary file
	Patterns     []string // Loaded patterns (populated at init)
}

// SupportedAttackTypes enumerates all attack categories handled by Mini SIEM.
var SupportedAttackTypes = []AttackType{
	{
		Action:      "XSS_Attempt",
		Label:       "XSS (CrowdSec)",
		Scenarios:   []string{"crowdsecurity/http-xss-probing"},
		PatternFile: "crowdsec/xss_probe_patterns.txt",
	},
	{
		Action:      "Brute_Force",
		Label:       "Brute Force (CrowdSec)",
		Scenarios:   []string{"crowdsecurity/http-bf-wordpress-bf", "crowdsecurity/http-generic-bf", "crowdsecurity/http-bad-user-agent"},
		PatternFile: "crowdsec/bruteforce_patterns.txt",
	},
	{
		Action:      "File_Inclusion",
		Label:       "File Inclusion (CrowdSec)",
		Scenarios:   []string{"crowdsecurity/http-path-traversal-probing", "crowdsecurity/http-open-proxy"},
		PatternFile: "crowdsec/file_inclusion_patterns.txt",
	},
	{
		Action:      "Command_Injection",
		Label:       "Command Injection (CrowdSec)",
		Scenarios:   []string{"crowdsecurity/http-generic-exploit", "crowdsecurity/http-cve-probing"},
		PatternFile: "crowdsec/command_injection_patterns.txt",
	},
	{
		Action:      "SQL_Injection",
		Label:       "SQL Injection (CrowdSec)",
		Scenarios:   []string{"crowdsecurity/http-sqli-probing"},
		PatternFile: "crowdsec/sql_injection_patterns.txt",
	},
}

// scenarioIndex maps a CrowdSec scenario name → index in SupportedAttackTypes.
var scenarioIndex map[string]int

func init() {
	scenarioIndex = make(map[string]int)
	for i := range SupportedAttackTypes {
		at := &SupportedAttackTypes[i]
		at.Patterns = loadPatternFile(at.PatternFile)
		for _, sc := range at.Scenarios {
			scenarioIndex[sc] = i
		}
	}
	log.Printf("✅ Pattern engine loaded: %d attack types, %d total scenarios",
		len(SupportedAttackTypes), len(scenarioIndex))
}

// loadPatternFile reads a pattern-per-line file, ignoring comments and blanks.
func loadPatternFile(filename string) []string {
	file, err := os.Open(filename)
	if err != nil {
		log.Printf("⚠️  Warning: could not load %s: %v", filename, err)
		return nil
	}
	defer file.Close()

	var patterns []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" && !strings.HasPrefix(line, "#") {
			patterns = append(patterns, line)
		}
	}
	if err := scanner.Err(); err != nil {
		log.Printf("⚠️  Error reading %s: %v", filename, err)
	}
	log.Printf("   📄 %s: %d patterns loaded", filename, len(patterns))
	return patterns
}

// SupportedScenarios returns a list of all CrowdSec scenario names handled by the SIEM.
func SupportedScenarios() []string {
	var out []string
	for _, at := range SupportedAttackTypes {
		out = append(out, at.Scenarios...)
	}
	return out
}

// resolveAttackType finds the AttackType for a given CrowdSec scenario.
// Falls back to a generic "Unknown_Attack" if the scenario is unrecognized.
func resolveAttackType(scenario string) *AttackType {
	if idx, ok := scenarioIndex[scenario]; ok {
		return &SupportedAttackTypes[idx]
	}
	return nil
}

// ─────────────────────────── Webhook Processing ───────────────────────────

// WebhookCallbacks defines the dependencies needed by the webhook to interact with the main application layer.
type WebhookCallbacks struct {
	Database   *sql.DB
	GetCountry func(ip string) string
	AddThreat  func(adminID, attackType, sourceIP, publicIP, severity, latestUpdate string)
	AddBlocked func(adminID, ip, blockedAt string) // Auto-block IP when CrowdSec issues a ban decision
	ClearBan   func(ip string)                     // Reset cooldowns so IP can be re-detected after admin unblock
}

// ProcessWebhookAlerts processes an array of alerts received via HTTP Webhook.
// It auto-detects the attack type from the CrowdSec scenario field.
// IPs with ban decisions are automatically added to the blocked list.
//
// adminID identifies the tenant (API Key owner) this alert belongs to.
// This enables multi-tenant data isolation in a SaaS context.
func ProcessWebhookAlerts(alerts []Alert, cb WebhookCallbacks, adminID string) int {
	if len(alerts) == 0 {
		return 0
	}

	newCount := 0
	for _, alert := range alerts {
		alertIDStr := fmt.Sprintf("cs_%d", alert.ID)

		// Check if we already have this alert (deduplication)
		var exists int
		err := cb.Database.QueryRow(
			"SELECT COUNT(*) FROM security_logs WHERE crowdsec_alert_id = ?",
			alertIDStr,
		).Scan(&exists)
		if err != nil {
			log.Printf("⚠️  DB check error for alert %s: %v", alertIDStr, err)
			continue
		}
		if exists > 0 {
			continue // Already stored
		}

		// Resolve attack type from scenario
		at := resolveAttackType(alert.Scenario)
		action := "Unknown_Attack"
		label := "Unknown (CrowdSec)"
		if at != nil {
			action = at.Action
			label = at.Label
		}

		// Build payload from alert events
		payload := buildAlertPayload(alert, at)
		severity := MapSeverity(alert)
		isBlocked := 0
		if len(alert.Decisions) > 0 {
			isBlocked = 1
		}

		// Extract user agent from first event if available
		userAgent := ""
		if len(alert.Events) > 0 {
			userAgent = ExtractMeta(alert.Events[0].Meta, "http_user_agent")
		}

		// Parse created_at
		createdAt := alert.CreatedAt
		if t, err := time.Parse(time.RFC3339, alert.CreatedAt); err == nil {
			createdAt = t.Format("2006-01-02 15:04:05")
		}

		// GeoIP from CrowdSec source data
		countryCode := alert.Source.CN
		if countryCode == "" {
			countryCode = cb.GetCountry(alert.Source.IP)
		}

		// Resolve public IP for GeoIP/globe visualization
		publicIP := helpers.ResolvePublicIP(alert.Source.IP)
		if publicIP != "" && countryCode == "" {
			countryCode = cb.GetCountry(publicIP)
		}

		// Insert into security_logs (dual-IP: ip_address = private, ip_address_public = public)
		_, err = cb.Database.Exec(`INSERT INTO security_logs
			(admin_id, user_identity, action, payload, severity, ip_address, ip_address_public, country_code, user_agent, is_blocked, crowdsec_alert_id, source, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			adminID,
			"crowdsec-detection",
			action,
			payload,
			severity,
			alert.Source.IP,
			publicIP,
			countryCode,
			userAgent,
			isBlocked,
			alertIDStr,
			"crowdsec",
			createdAt,
		)
		if err != nil {
			log.Printf("⚠️  DB insert error for CrowdSec alert %s: %v", alertIDStr, err)
			continue
		}

		newCount++

		// Update in-memory threat store
		timeStr := time.Now().Format("15:04")
		if cb.AddThreat != nil {
			cb.AddThreat(adminID, label, alert.Source.IP, publicIP, severity, fmt.Sprintf("Detected %s", timeStr))
		}

		// Auto-block: if CrowdSec issued a ban decision, add IP to blocked list
		if isBlocked == 1 && cb.AddBlocked != nil {
			cb.AddBlocked(adminID, alert.Source.IP, timeStr)
			log.Printf("🚫 Auto-blocked IP %s (CrowdSec %s decision)", alert.Source.IP, alert.Decisions[0].Type)
		}
	}

	if newCount > 0 {
		log.Printf("🛡️  CrowdSec Webhook: %d new alert(s) stored in security_logs", newCount)
	}
	return newCount
}

// ─────────────────────────── Payload Builder ───────────────────────────

// buildAlertPayload creates a JSON payload from a CrowdSec alert for storage.
// Works for all attack types by matching against the appropriate pattern set.
func buildAlertPayload(alert Alert, at *AttackType) string {
	type alertPayload struct {
		Scenario    string   `json:"scenario"`
		AttackType  string   `json:"attack_type"`
		Message     string   `json:"message"`
		EventsCount int      `json:"events_count"`
		SourceIP    string   `json:"source_ip"`
		StartAt     string   `json:"start_at"`
		StopAt      string   `json:"stop_at"`
		Patterns    []string `json:"patterns_matched"`
		HTTPArgs    []string `json:"http_args,omitempty"`
		HTTPPaths   []string `json:"http_paths,omitempty"`
		Decisions   []string `json:"decisions,omitempty"`
	}

	action := "Unknown"
	if at != nil {
		action = at.Action
	}

	p := alertPayload{
		Scenario:    alert.Scenario,
		AttackType:  action,
		Message:     alert.Message,
		EventsCount: alert.EventsCount,
		SourceIP:    alert.Source.IP,
		StartAt:     alert.StartAt,
		StopAt:      alert.StopAt,
	}

	// Extract patterns, HTTP args, and paths from events
	seenArgs := make(map[string]bool)
	seenPaths := make(map[string]bool)
	for _, evt := range alert.Events {
		httpArgs := ExtractMeta(evt.Meta, "http_args")
		if httpArgs != "" && !seenArgs[httpArgs] {
			seenArgs[httpArgs] = true
			p.HTTPArgs = append(p.HTTPArgs, httpArgs)
			// Match against the attack type's specific patterns
			if at != nil && len(at.Patterns) > 0 {
				patterns := identifyPatterns(httpArgs, at.Patterns)
				p.Patterns = appendUnique(p.Patterns, patterns...)
			}
		}
		httpPath := ExtractMeta(evt.Meta, "http_path")
		if httpPath != "" && !seenPaths[httpPath] {
			seenPaths[httpPath] = true
			p.HTTPPaths = append(p.HTTPPaths, httpPath)
			// Also match path against patterns (useful for LFI/RFI, command injection)
			if at != nil && len(at.Patterns) > 0 {
				patterns := identifyPatterns(httpPath, at.Patterns)
				p.Patterns = appendUnique(p.Patterns, patterns...)
			}
		}
	}

	// Decisions
	for _, d := range alert.Decisions {
		p.Decisions = append(p.Decisions, fmt.Sprintf("%s:%s(%s)", d.Type, d.Scope, d.Value))
	}

	jsonBytes, _ := json.Marshal(p)
	return string(jsonBytes)
}

// ─────────────────────────── Pattern Matching ───────────────────────────

// identifyPatterns checks which patterns from a given set are present in the input string.
func identifyPatterns(input string, patterns []string) []string {
	upper := strings.ToUpper(input)
	var matched []string
	for _, pattern := range patterns {
		if strings.Contains(upper, strings.ToUpper(pattern)) {
			matched = append(matched, pattern)
		}
	}
	return matched
}

func appendUnique(slice []string, items ...string) []string {
	seen := make(map[string]bool, len(slice))
	for _, s := range slice {
		seen[s] = true
	}
	for _, item := range items {
		if !seen[item] {
			seen[item] = true
			slice = append(slice, item)
		}
	}
	return slice
}
