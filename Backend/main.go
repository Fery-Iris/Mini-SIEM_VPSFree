package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/FamilyJewelsRuined/mini-siem-be/crowdsec"
	"github.com/FamilyJewelsRuined/mini-siem-be/database"
	"github.com/FamilyJewelsRuined/mini-siem-be/handlers"
	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
	"github.com/FamilyJewelsRuined/mini-siem-be/middleware"
	"github.com/FamilyJewelsRuined/mini-siem-be/models"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if exists
	if err := godotenv.Load(); err != nil {
		log.Println("you fucked up, there aint no .env file, maybe check .env.example. if there are .env.example file, just rename it to .env")
	}

	// ── Database ──
	database.InitDB()
	store := models.NewStore()
	store.LoadFromDB(database.DB) // hydrate from existing CrowdSec security_logs

	// ── CrowdSec Integration ──
	csCfg := crowdsec.LoadConfig()
	csClient := crowdsec.NewClient(csCfg)
	log.Printf("🔗 CrowdSec LAPI: %s (machine: %s)", csCfg.LAPIURL, csCfg.MachineID)

	cb := crowdsec.WebhookCallbacks{
		Database: database.DB,
		GetCountry: func(ip string) string {
			return helpers.LookupGeoIP(ip).CountryCode
		},
		AddThreat: func(adminID, attackType, sourceIP, publicIP, severity, latestUpdate string) {
			// Use public IP for GeoIP (globe visualization), fall back to sourceIP
			geoTarget := publicIP
			if geoTarget == "" {
				geoTarget = sourceIP
			}
			geo := helpers.LookupGeoIP(geoTarget)
			store.Mu.Lock()
			store.Threats = append([]models.ThreatRow{{
				AdminID:      adminID,
				AttackType:   attackType,
				SourceIP:     sourceIP,
				PublicIP:     publicIP,
				Severity:     severity,
				LatestUpdate: latestUpdate,
				CountryCode:  geo.CountryCode,
				Country:      geo.Country,
				Lat:          geo.Lat,
				Lng:          geo.Lng,
			}}, store.Threats...)
			store.Mu.Unlock()
		},
		AddBlocked: func(adminID, ip, blockedAt string) {
			store.Mu.Lock()
			store.BlockedIPs = append([]models.BlockedIP{{
				AdminID:   adminID,
				IP:        ip,
				BlockedAt: blockedAt,
			}}, store.BlockedIPs...)
			store.Mu.Unlock()
		},
	}

	// ── Background LAPI Poller (Fallback if plugin crashes) ──
	// LAPI polling is system-level: alerts don't come through a per-tenant API key.
	// Use LAPI_DEFAULT_ADMIN env to assign these alerts (defaults to "1").
	lapiAdminID := "1"
	if v := os.Getenv("LAPI_DEFAULT_ADMIN"); v != "" {
		lapiAdminID = v
	}
	go func() {
		log.Printf("⏱️ Starting CrowdSec LAPI Background Poller (admin_id=%s)...", lapiAdminID)
		for {
			time.Sleep(5 * time.Second)
			alerts, err := csClient.FetchAllAlerts()
			if err == nil && len(alerts) > 0 {
				count := crowdsec.ProcessWebhookAlerts(alerts, cb, lapiAdminID)
				if count > 0 {
					log.Printf("🔥 Polled %d new alerts from LAPI (→ admin %s)!", count, lapiAdminID)
				}
			}
		}
	}()

	// ── Apache Access Log Watcher (Real-time attack detection) ──
	apacheLogPath := `C:\xampp\apache\logs\access.log`
	if v := os.Getenv("APACHE_LOG_PATH"); v != "" {
		apacheLogPath = v
	}
	logWatcher := crowdsec.NewLogWatcher(apacheLogPath, cb)
	cb.ClearBan = logWatcher.ClearBan // Wire up so unblock handler can reset LogWatcher cooldowns
	logWatcher.Callbacks = cb         // Update with the completed callbacks
	go logWatcher.Start()

	// ── Routes ──
	mux := http.NewServeMux()

	// Public routes (no JWT required)
	mux.HandleFunc("/api/health", handlers.HandleHealth)
	mux.HandleFunc("/api/auth/login", handlers.HandleLogin)
	mux.HandleFunc("/api/auth/register", handlers.HandleRegister)
	mux.HandleFunc("/api/auth/verify", handlers.HandleVerifyEmail)
	mux.HandleFunc("/api/alerts/webhook", handlers.HandleCrowdSecWebhook(cb))

	// Protected routes (JWT required — admin_id extracted from token)
	protected := http.NewServeMux()
	protected.HandleFunc("/api/dashboard/stats", handlers.HandleDashboardStats(store))
	protected.HandleFunc("/api/dashboard/logs", handlers.HandleDashboardLogs)
	protected.HandleFunc("/api/detection/threats", handlers.HandleDetectionThreats(store))
	protected.HandleFunc("/api/detection/block", handlers.HandleBlockIP(store))
	protected.HandleFunc("/api/blocked", handlers.HandleGetBlocked(store))
	protected.HandleFunc("/api/blocked/unblock", handlers.HandleUnblockIP(store, cb))
	protected.HandleFunc("/api/apikeys", handlers.HandleGetAPIKeys)
	protected.HandleFunc("/api/apikeys/generate", handlers.HandleGenerateAPIKey)
	protected.HandleFunc("/api/apikeys/delete", handlers.HandleDeleteAPIKey)
	protected.HandleFunc("/api/crowdsec/status", handlers.HandleCrowdSecStatus(csClient))

	// Mount protected routes behind RequireAuth middleware
	mux.Handle("/api/dashboard/", middleware.RequireAuth(protected))
	mux.Handle("/api/detection/", middleware.RequireAuth(protected))
	mux.Handle("/api/blocked", middleware.RequireAuth(protected))
	mux.Handle("/api/blocked/", middleware.RequireAuth(protected))
	mux.Handle("/api/apikeys", middleware.RequireAuth(protected))
	mux.Handle("/api/apikeys/", middleware.RequireAuth(protected))
	mux.Handle("/api/crowdsec/", middleware.RequireAuth(protected))

	// ── Start Server ──
	addr := ":8081"
	log.Printf("🚀 Mini SIEM Backend running on http://localhost%s", addr)
	log.Printf("📋 Public:    /api/health | /api/auth/login | /api/auth/register | /api/alerts/webhook")
	log.Printf("🔒 Protected: /api/dashboard/* | /api/detection/* | /api/blocked/* | /api/apikeys/* | /api/crowdsec/*")

	if err := http.ListenAndServe(addr, middleware.CORSMiddleware(mux)); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
	}
}
