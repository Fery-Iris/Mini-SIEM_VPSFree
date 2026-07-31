package crowdsec

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
)

// ─────────────── Brute Force Rate Limiting Configuration ───────────────
// Brute force is ONLY flagged when an IP exceeds a request-frequency
// threshold to login paths within a sliding time window.
// This prevents false positives from normal admin logins.
var (
	bfThreshold   = getEnvInt("BF_THRESHOLD", 5)                 // min requests to trigger
	bfWindow      = getEnvDuration("BF_WINDOW_SEC", 30)          // sliding window in seconds
	bfBanDuration = getEnvDuration("BF_BAN_DURATION_SEC", 14400) // cooldown after detection (default 4h = 14400s)
)

// maxSeenLines caps the deduplication cache to prevent unbounded memory growth.
// When exceeded, the cache is cleared. The DB-level unique index on
// crowdsec_alert_id provides a secondary dedup safety net.
const maxSeenLines = 10000

// loginPaths lists sensitive authentication endpoints monitored for brute force.
var loginPaths = []string{
	"/wp-login", "/wp-admin", "/admin/login",
	"/auth/login", "/login.php", "/signin",
	"/vulnerabilities/brute", // DVWA brute force page (both /dvwa/ and /DVWA-master/ prefixed)
}

// whitelistedIPs are never flagged as attackers (localhost, internal services).
// Configurable via WHITELISTED_IPS env var (comma-separated).
// When running behind a reverse proxy on VPS, 127.0.0.1 should NOT be
// whitelisted because Apache may log the proxy IP instead of the real client.
var whitelistedIPs = initWhitelistedIPs()

func initWhitelistedIPs() map[string]bool {
	// Check if user provided custom whitelist
	if v := os.Getenv("WHITELISTED_IPS"); v != "" {
		m := make(map[string]bool)
		for _, ip := range strings.Split(v, ",") {
			ip = strings.TrimSpace(ip)
			if ip != "" {
				m[ip] = true
			}
		}
		return m
	}
	// Default whitelist
	return map[string]bool{
		"127.0.0.1": true,
		"::1":       true,
		"localhost": true,
	}
}

// whitelistedUserAgents are never flagged — prevents backend from detecting its own internal requests.
var whitelistedUserAgents = []string{
	"Go-http-client", // Go's default HTTP client (used by this backend for CrowdSec LAPI polling)
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

func getEnvDuration(key string, fallbackSec int) time.Duration {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return time.Duration(n) * time.Second
		}
	}
	return time.Duration(fallbackSec) * time.Second
}

// LogWatcher monitors an Apache access.log file in real-time and detects
// attacks using the Mini-SIEM pattern engine. This provides direct detection
// without depending on CrowdSec engine stability on Windows.
type LogWatcher struct {
	LogPath   string
	AdminID   string // tenant scope: configurable via LOG_WATCHER_ADMIN env
	DB        *sql.DB
	Callbacks WebhookCallbacks

	// seenMu protects seenLines from concurrent access between
	// processLine (LogWatcher goroutine) and ClearBan (HTTP handler goroutine).
	seenMu     sync.Mutex
	seenLines  map[string]bool
	alertCount int

	// bfMu protects brute-force rate limiter and firewall ban maps.
	bfMu       sync.Mutex
	bfAttempts map[string][]time.Time
	// BF cooldown: prevents duplicate BF alerts from the same IP.
	bfBanned map[string]time.Time // IP → BF cooldown expiry
	// Firewall ban tracker: prevents calling cscli multiple times for same IP.
	// Separate from bfBanned so BF detection doesn't block the cscli call.
	fwBanned map[string]time.Time // IP → firewall ban expiry

	// Uptime and Health
	startTime    time.Time
	lastReadUnix int64 // updated atomically
}

// apacheLogLine represents a parsed Apache Combined Log Format entry.
type apacheLogLine struct {
	IP        string
	Timestamp string
	Method    string
	Path      string
	Query     string
	Status    string
	UserAgent string
	RawLine   string
}

// Apache Combined Log Format regex
// 192.168.56.101 - - [26/Apr/2026:20:05:53 +0800] "GET /path?query HTTP/1.1" 200 4939 "referer" "user-agent"
var apacheLogRegex = regexp.MustCompile(
	`^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d+)\s+\S+\s+"[^"]*"\s+"([^"]*)"`,
)

// NewLogWatcher creates a new LogWatcher instance.
func NewLogWatcher(logPath string, cb WebhookCallbacks) *LogWatcher {
	adminID := "1"
	if v := os.Getenv("LOG_WATCHER_ADMIN"); v != "" {
		adminID = v
	}
	lw := &LogWatcher{
		LogPath:    logPath,
		AdminID:    adminID,
		DB:         cb.Database,
		Callbacks:  cb,
		seenLines:  make(map[string]bool),
		bfAttempts: make(map[string][]time.Time),
		bfBanned:   make(map[string]time.Time),
		fwBanned:   make(map[string]time.Time),
		startTime:  time.Now(),
	}
	atomic.StoreInt64(&lw.lastReadUnix, time.Now().Unix())
	log.Printf("🔒 Brute-force rate limiter: threshold=%d requests within %s window (cooldown=%s)", bfThreshold, bfWindow, bfBanDuration)
	return lw
}

// startHeartbeat runs a background goroutine to log watcher health periodically.
func (lw *LogWatcher) startHeartbeat() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			uptime := time.Since(lw.startTime).Round(time.Second)
			lastRead := time.Unix(atomic.LoadInt64(&lw.lastReadUnix), 0)
			idleTime := time.Since(lastRead).Round(time.Second)
			log.Printf("💓 LogWatcher Heartbeat: Uptime=%s, IdleTime=%s, Active=true", uptime, idleTime)
		}
	}()
}

// Start begins watching the Apache access.log file for new entries.
// It tails the file, automatically handling log rotations and transient read errors.
func (lw *LogWatcher) Start() {
	log.Printf("👁️  LogWatcher: Monitoring %s for attacks...", lw.LogPath)
	lw.startBFCleanup() // background goroutine to prune stale rate-limiter entries
	lw.startHeartbeat() // background goroutine to report health

	var file *os.File
	var err error

	// Infinite outer loop prevents goroutine from dying on transient errors
	for {
		// Attempt to open the file
		if file != nil {
			file.Close()
			file = nil
		}

		file, err = os.Open(lw.LogPath)
		if err != nil {
			log.Printf("❌ LogWatcher: Cannot open %s: %v. Retrying in 5s...", lw.LogPath, err)
			time.Sleep(5 * time.Second)
			continue
		}

		// Seek to end of file so we only detect NEW attacks
		file.Seek(0, io.SeekEnd)
		
		// Get initial file info for rotation detection
		var openFileInfo os.FileInfo
		openFileInfo, err = file.Stat()
		if err != nil {
			log.Printf("❌ LogWatcher: Cannot stat opened file: %v. Retrying in 5s...", err)
			time.Sleep(5 * time.Second)
			continue
		}

		buf := make([]byte, 4096)
		var partial string
		rotationCheckTicker := time.NewTicker(2 * time.Second)

		// Inner read loop
	readLoop:
		for {
			select {
			case <-rotationCheckTicker.C:
				// Check for log rotation: compare current path info with open file info
				pathInfo, statErr := os.Stat(lw.LogPath)
				if statErr == nil {
					// On Windows, os.SameFile works by comparing VolumeSerialNumber and FileIndex
					if !os.SameFile(openFileInfo, pathInfo) {
						log.Printf("🔄 LogWatcher: Log rotation detected for %s (new file). Re-opening...", lw.LogPath)
						rotationCheckTicker.Stop()
						break readLoop // break to outer loop to reopen
					}
				}
			default:
				// Continue to read
			}

			n, err := file.Read(buf)
			if n > 0 {
				data := partial + string(buf[:n])
				partial = ""

				lines := strings.Split(data, "\n")
				// Last element might be incomplete
				if !strings.HasSuffix(data, "\n") {
					partial = lines[len(lines)-1]
					lines = lines[:len(lines)-1]
				}

				for _, line := range lines {
					line = strings.TrimSpace(line)
					if line == "" {
						continue
					}
					// Wrap processLine in recover to prevent goroutine death
					func() {
						defer func() {
							if r := recover(); r != nil {
								log.Printf("🚨 LogWatcher PANIC in processLine (recovered): %v", r)
							}
						}()
						lw.processLine(line)
					}()
				}
			}
			
			if err == io.EOF {
				// Detect file truncation (logrotate/manual clear):
				if info, statErr := file.Stat(); statErr == nil {
					pos, _ := file.Seek(0, io.SeekCurrent)
					if pos > info.Size() {
						log.Printf("🔄 LogWatcher: File truncated (pos=%d > size=%d), re-seeking to start", pos, info.Size())
						file.Seek(0, io.SeekStart)
					}
				}
				time.Sleep(500 * time.Millisecond)
				continue
			}
			
			if err != nil {
				log.Printf("❌ LogWatcher: Read error: %v. Attempting recovery...", err)
				rotationCheckTicker.Stop()
				time.Sleep(2 * time.Second)
				break readLoop // break to outer loop to reopen
			}
		}
	}
}

// processLine parses a single Apache log line and checks for attack patterns.
// Uses best-match logic: evaluates ALL attack types and picks the one with the
// most pattern matches for highest accuracy.
func (lw *LogWatcher) processLine(line string) {
	atomic.StoreInt64(&lw.lastReadUnix, time.Now().Unix())
	parsed := parseApacheLog(line)
	if parsed == nil {
		return
	}

	// Skip whitelisted IPs (localhost, internal services)
	if whitelistedIPs[parsed.IP] {
		return
	}

	// Skip whitelisted User-Agents (backend's own internal requests)
	for _, wua := range whitelistedUserAgents {
		if strings.Contains(parsed.UserAgent, wua) {
			return
		}
	}

	log.Printf("📋 LogWatcher processLine: IP=%s Path=%s Query=%s", parsed.IP, parsed.Path, parsed.Query)

	// URL-decode the path+query for pattern matching
	fullURL := parsed.Path
	if parsed.Query != "" {
		fullURL += "?" + parsed.Query
	}
	decoded, err := url.QueryUnescape(fullURL)
	if err != nil {
		decoded = fullURL
	}

	// Evaluate ALL attack types and pick the best match (most patterns matched)
	var bestAT *AttackType
	var bestMatched []string
	bestScore := 0

	for i, at := range SupportedAttackTypes {
		if len(at.Patterns) == 0 {
			continue
		}

		var matched []string

		if at.Action == "Brute_Force" {
			// ── STEP 1: Known attack User-Agent (e.g. Hydra, sqlmap) ──
			// If the UA itself matches brute-force tool signatures, flag immediately
			// regardless of rate — these tools are never legitimate.
			matched = identifyPatterns(parsed.UserAgent, at.Patterns)

			if len(matched) == 0 {
				// ── STEP 2: Login-path rate limiting ──
				// A normal user visiting /login.php once is NOT brute force.
				// Only flag when the SAME IP hits login paths at an
				// anomalous frequency (≥ threshold within the time window).
				//
				// Detection triggers on:
				//   a) Request path matches a known login endpoint, OR
				//   b) Query string contains auth parameters (username= AND password=)
				//      This catches forms like DVWA /vulnerabilities/brute/

				// ── COOLDOWN CHECK: skip if IP already banned ──
				// Prevents thousands of duplicate entries from a single attack.
				lw.bfMu.Lock()
				if expiry, banned := lw.bfBanned[parsed.IP]; banned {
					if time.Now().Before(expiry) {
						lw.bfMu.Unlock()
						continue // Skip BF check only — other attack types still evaluated
					}
					// Ban expired, remove and re-evaluate
					delete(lw.bfBanned, parsed.IP)
				}
				lw.bfMu.Unlock()

				var hitPath string

				// (a) Check against known login paths
				for _, lp := range loginPaths {
					if strings.Contains(strings.ToLower(parsed.Path), strings.ToLower(lp)) {
						hitPath = lp
						break
					}
				}

				// (b) Check for auth parameters in query string
				if hitPath == "" && parsed.Query != "" {
					qLower := strings.ToLower(parsed.Query)
					hasUser := strings.Contains(qLower, "username=") || strings.Contains(qLower, "user=")
					hasPass := strings.Contains(qLower, "password=") || strings.Contains(qLower, "passwd=") || strings.Contains(qLower, "pass=")
					if hasUser && hasPass {
						hitPath = parsed.Path + "?credentials"
					}
				}

				if hitPath != "" {
					count := lw.recordAndCount(parsed.IP)
					if count >= bfThreshold {
						matched = append(matched,
							fmt.Sprintf("%s (rate: %d/%ds)", hitPath, count, int(bfWindow.Seconds())))
						// BF cooldown is set AFTER detection completes (in the firewall ban section)
						// to avoid blocking the cscli ban call.
					}
					// Below threshold → NOT brute force, skip silently
				}
			}
		} else {
			// All other attack types: match against the decoded URL (path + query)
			// Only use patterns with 3+ characters to avoid false positives
			matched = identifyPatternsMinLen(decoded, at.Patterns, 3)
		}

		if len(matched) > bestScore {
			bestScore = len(matched)
			bestAT = &SupportedAttackTypes[i]
			bestMatched = matched
		}
	}

	// No attack detected
	if bestAT == nil || bestScore == 0 {
		return
	}

	// Generate a unique alert ID
	lw.alertCount++
	alertID := fmt.Sprintf("logwatch_%d_%d", time.Now().Unix(), lw.alertCount)

	// Prune seenLines if it grows too large to prevent memory leak.
	lw.seenMu.Lock()
	if len(lw.seenLines) > maxSeenLines {
		lw.seenLines = make(map[string]bool)
		log.Printf("🧹 LogWatcher: Pruned seenLines dedup cache (exceeded %d entries)", maxSeenLines)
	}

	// Deduplicate: skip if we've already seen this exact line
	lineHash := fmt.Sprintf("%s_%s_%s", parsed.IP, parsed.Timestamp, bestAT.Action)
	if lw.seenLines[lineHash] {
		lw.seenMu.Unlock()
		return
	}
	lw.seenLines[lineHash] = true
	lw.seenMu.Unlock()

	// Determine severity
	severity := "Critical"

	// Build payload
	payload := lw.buildLogPayload(parsed, *bestAT, bestMatched, decoded)

	// Parse timestamp
	createdAt := time.Now().Format("2006-01-02 15:04:05")

	// Resolve public IP for GeoIP/globe visualization
	publicIP := helpers.ResolvePublicIP(parsed.IP)

	// Determine country code from public IP (if available), otherwise from private IP
	countryCode := ""
	if publicIP != "" {
		countryCode = lw.Callbacks.GetCountry(publicIP)
	}
	if countryCode == "" {
		countryCode = lw.Callbacks.GetCountry(parsed.IP)
	}

	// Insert into security_logs (dual-IP: ip_address = private, ip_address_public = public)
	_, dbErr := lw.DB.Exec(`INSERT INTO security_logs
		(admin_id, user_identity, action, payload, severity, ip_address, ip_address_public, country_code, user_agent, is_blocked, crowdsec_alert_id, source, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		lw.AdminID,
		"crowdsec-detection",
		bestAT.Action,
		payload,
		severity,
		parsed.IP,
		publicIP,
		countryCode,
		parsed.UserAgent,
		1, // Mark as blocked
		alertID,
		"crowdsec",
		createdAt,
	)
	if dbErr != nil {
		log.Printf("⚠️  LogWatcher DB insert error: %v", dbErr)
		return
	}

	// Update in-memory store
	timeStr := time.Now().Format("15:04")
	if lw.Callbacks.AddThreat != nil {
		lw.Callbacks.AddThreat(lw.AdminID, bestAT.Label, parsed.IP, publicIP, severity, fmt.Sprintf("Detected %s", timeStr))
	}
	if lw.Callbacks.AddBlocked != nil {
		lw.Callbacks.AddBlocked(lw.AdminID, parsed.IP, timeStr)
	}

	// ── Firewall Ban (async, rate-limited) ──
	// Runs cscli in a separate goroutine so it NEVER blocks LogWatcher.
	// Uses fwBanned (separate from bfBanned) to track firewall-level bans.
	lw.bfMu.Lock()
	_, alreadyFWBanned := lw.fwBanned[parsed.IP]
	if !alreadyFWBanned {
		lw.fwBanned[parsed.IP] = time.Now().Add(bfBanDuration)
	}
	// Also set BF cooldown if this was a brute force detection
	if bestAT.Action == "Brute_Force" {
		lw.bfBanned[parsed.IP] = time.Now().Add(bfBanDuration)
		log.Printf("🛡️ BF Cooldown: %s banned for %s (no further BF alerts until expiry)", parsed.IP, bfBanDuration)
	}
	lw.bfMu.Unlock()
	if !alreadyFWBanned {
		go func(ip, reason string) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, "cscli", "decisions", "add",
				"-i", ip, "-d", "4h", "-t", "ban", "-R", reason)
			if err := cmd.Run(); err != nil {
				log.Printf("⚠️ Firewall Ban Failed for %s: %v", ip, err)
			} else {
				log.Printf("🛑 Firewall Bouncer: DROP %s (reason: %s)", ip, reason)
			}
		}(parsed.IP, bestAT.Action)
	}

	log.Printf("🔥 ATTACK DETECTED [%s] from %s (public: %s) → %s (patterns: %v)",
		bestAT.Action, parsed.IP, publicIP, decoded, bestMatched)
}

// buildLogPayload creates a JSON payload from a detected attack.
func (lw *LogWatcher) buildLogPayload(parsed *apacheLogLine, at AttackType, matched []string, decoded string) string {
	type logPayload struct {
		Scenario    string   `json:"scenario"`
		AttackType  string   `json:"attack_type"`
		Message     string   `json:"message"`
		SourceIP    string   `json:"source_ip"`
		RequestPath string   `json:"request_path"`
		DecodedURL  string   `json:"decoded_url"`
		UserAgent   string   `json:"user_agent"`
		Patterns    []string `json:"patterns_matched"`
		Timestamp   string   `json:"timestamp"`
		Decisions   []string `json:"decisions"`
	}

	scenario := ""
	if len(at.Scenarios) > 0 {
		scenario = at.Scenarios[0]
	}

	p := logPayload{
		Scenario:    scenario,
		AttackType:  at.Action,
		Message:     fmt.Sprintf("Detected %s attack from %s", at.Label, parsed.IP),
		SourceIP:    parsed.IP,
		RequestPath: parsed.Path,
		DecodedURL:  decoded,
		UserAgent:   parsed.UserAgent,
		Patterns:    matched,
		Timestamp:   parsed.Timestamp,
		Decisions:   []string{"ban:Ip(" + parsed.IP + ")"},
	}

	jsonBytes, _ := json.Marshal(p)
	return string(jsonBytes)
}

// parseApacheLog parses a single Apache Combined Log Format line.
func parseApacheLog(line string) *apacheLogLine {
	matches := apacheLogRegex.FindStringSubmatch(line)
	if matches == nil {
		return nil
	}

	pathAndQuery := matches[4]
	path := pathAndQuery
	query := ""
	if idx := strings.Index(pathAndQuery, "?"); idx != -1 {
		path = pathAndQuery[:idx]
		query = pathAndQuery[idx+1:]
	}

	return &apacheLogLine{
		IP:        matches[1],
		Timestamp: matches[2],
		Method:    matches[3],
		Path:      path,
		Query:     query,
		Status:    matches[5],
		UserAgent: matches[6],
		RawLine:   line,
	}
}

// identifyPatternsMinLen is like identifyPatterns but skips patterns shorter
// than minLen characters to avoid false positives from generic short patterns.
func identifyPatternsMinLen(input string, patterns []string, minLen int) []string {
	upper := strings.ToUpper(input)
	var matched []string
	for _, pattern := range patterns {
		if len(pattern) < minLen {
			continue // Skip patterns too short (e.g., "id", ";", "#")
		}
		if strings.Contains(upper, strings.ToUpper(pattern)) {
			matched = append(matched, pattern)
		}
	}
	return matched
}

// ─────────────── Brute Force Rate Limiter ───────────────

// recordAndCount records a login-path access for the given IP and returns
// how many accesses occurred within the current sliding window.
// It also prunes expired entries to keep memory bounded.
func (lw *LogWatcher) recordAndCount(ip string) int {
	lw.bfMu.Lock()
	defer lw.bfMu.Unlock()

	now := time.Now()
	cutoff := now.Add(-bfWindow)

	// Append current attempt
	lw.bfAttempts[ip] = append(lw.bfAttempts[ip], now)

	// Prune expired timestamps and count recent ones
	recent := make([]time.Time, 0, len(lw.bfAttempts[ip]))
	for _, t := range lw.bfAttempts[ip] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	lw.bfAttempts[ip] = recent

	return len(recent)
}

// startBFCleanup runs a background goroutine that periodically purges
// stale rate-limiter entries to prevent unbounded memory growth.
func (lw *LogWatcher) startBFCleanup() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			lw.bfMu.Lock()
			now := time.Now()
			cutoff := now.Add(-bfWindow)

			// Prune stale rate-limiter entries
			for ip, timestamps := range lw.bfAttempts {
				var recent []time.Time
				for _, t := range timestamps {
					if t.After(cutoff) {
						recent = append(recent, t)
					}
				}
				if len(recent) == 0 {
					delete(lw.bfAttempts, ip)
				} else {
					lw.bfAttempts[ip] = recent
				}
			}

			// Prune expired cooldown bans
			for ip, expiry := range lw.bfBanned {
				if now.After(expiry) {
					delete(lw.bfBanned, ip)
				}
			}

			// Prune expired firewall ban trackers
			for ip, expiry := range lw.fwBanned {
				if now.After(expiry) {
					delete(lw.fwBanned, ip)
				}
			}

			lw.bfMu.Unlock()
		}
	}()
}

// ClearBan resets all internal cooldown/rate-limiter state for a given IP.
// Called by the unblock handler when an admin explicitly unblocks an IP.
// This ensures the IP is fully eligible for re-detection and re-banning
// if it attacks again — unblock is a temporary reprieve, not a permanent exemption.
func (lw *LogWatcher) ClearBan(ip string) {
	lw.bfMu.Lock()
	delete(lw.bfBanned, ip)
	delete(lw.bfAttempts, ip)
	delete(lw.fwBanned, ip)
	lw.bfMu.Unlock()

	// Remove from seenLines so the same attack signature can be re-detected.
	// Protected by seenMu to avoid concurrent map access with processLine.
	lw.seenMu.Lock()
	for key := range lw.seenLines {
		if strings.HasPrefix(key, ip+"_") {
			delete(lw.seenLines, key)
		}
	}
	lw.seenMu.Unlock()
	log.Printf("🔓 ClearBan: Reset all cooldowns for %s (eligible for re-detection)", ip)
}
