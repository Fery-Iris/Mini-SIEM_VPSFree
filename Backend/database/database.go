package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/FamilyJewelsRuined/mini-siem-be/helpers"
	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

// getEnv reads an environment variable with a fallback default.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// DB is the global database connection pool.
var DB *sql.DB

// InitDB connects to MySQL, creates the database and tables, and seeds default data.
func InitDB() {
	// Build MySQL DSN from environment variables
	dbUser := getEnv("MYSQL_USER", "root")
	dbPass := getEnv("MYSQL_PASSWORD", "")
	dbHost := getEnv("MYSQL_HOST", "127.0.0.1")
	dbPort := getEnv("MYSQL_PORT", "3306")
	dbName := getEnv("MYSQL_DATABASE", "minisiem")

	rootDSN := fmt.Sprintf("%s:%s@tcp(%s:%s)/?parseTime=true", dbUser, dbPass, dbHost, dbPort)
	rootDB, err := sql.Open("mysql", rootDSN)
	if err != nil {
		log.Fatalf("❌ Error connecting to MySQL: %v", err)
	}
	defer rootDB.Close()

	if err := rootDB.Ping(); err != nil {
		log.Fatalf("❌ Error pinging MySQL (Is XAMPP running?): %v", err)
	}

	_, err = rootDB.Exec("CREATE DATABASE IF NOT EXISTS " + dbName)
	if err != nil {
		log.Fatalf("❌ Error creating database %s: %v", dbName, err)
	}

	appDSN := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true", dbUser, dbPass, dbHost, dbPort, dbName)
	DB, err = sql.Open("mysql", appDSN)
	if err != nil {
		log.Fatalf("❌ Error connecting to %s database: %v", dbName, err)
	}

	// Connection pool settings for production stability
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	// ── admins table ──
	if _, err := DB.Exec(`CREATE TABLE IF NOT EXISTS admins (
		id INT AUTO_INCREMENT PRIMARY KEY,
		email VARCHAR(100) NOT NULL UNIQUE,
		password VARCHAR(255) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		log.Fatalf("❌ Error creating admins table: %v", err)
	}

	var adminCount int
	DB.QueryRow("SELECT COUNT(*) FROM admins").Scan(&adminCount)
	if adminCount == 0 {
		hashed, _ := bcrypt.GenerateFromPassword([]byte("demo1234"), bcrypt.DefaultCost)
		DB.Exec("INSERT INTO admins (email, password) VALUES (?, ?)", "admin@xrsecurity.com", string(hashed))
		log.Println("✅ Default admin seeded (admin@xrsecurity.com / demo1234).")
	} else {
		log.Printf("✅ Admins table ready (%d users).", adminCount)
	}

	// ── security_logs table ──
	if _, err := DB.Exec(`CREATE TABLE IF NOT EXISTS security_logs (
		id INT AUTO_INCREMENT PRIMARY KEY,
		timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		level ENUM('INFO','WARN','ERROR') NOT NULL DEFAULT 'INFO',
		source_ip VARCHAR(50) NOT NULL,
		port_id VARCHAR(50),
		action VARCHAR(100) NOT NULL DEFAULT '',
		badge_text VARCHAR(50),
		badge_color VARCHAR(200),
		user_identity VARCHAR(200),
		expandable TINYINT(1) DEFAULT 0,
		fingerprint TEXT,
		detail TEXT,
		country_code VARCHAR(10),
		country VARCHAR(100),
		flag VARCHAR(20),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		log.Fatalf("❌ Error creating security_logs table: %v", err)
	}

	// ── CrowdSec columns (safe to run multiple times) ──
	DB.Exec(`ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS crowdsec_alert_id VARCHAR(100) DEFAULT NULL`)
	DB.Exec(`ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual'`)
	// Unique index for deduplication (ignore error if already exists)
	DB.Exec(`CREATE UNIQUE INDEX idx_crowdsec_alert ON security_logs (crowdsec_alert_id)`)
	log.Println("✅ CrowdSec columns ensured on security_logs.")

	// ── Public IP column (dual-IP architecture: private for blocking, public for GeoIP) ──
	DB.Exec(`ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS ip_address_public VARCHAR(50) DEFAULT NULL`)
	log.Println("✅ ip_address_public column ensured on security_logs.")

	// ── Performance indexes for dashboard aggregate queries ──
	// These composite indexes eliminate full table scans on the stats endpoint.
	// Safe to run multiple times (duplicate key errors are silently ignored).
	DB.Exec(`CREATE INDEX idx_logs_admin_blocked_date ON security_logs (admin_id, is_blocked, created_at)`)
	DB.Exec(`CREATE INDEX idx_logs_admin_severity_date ON security_logs (admin_id, severity, created_at)`)
	DB.Exec(`CREATE INDEX idx_logs_admin_source ON security_logs (admin_id, source)`)
	DB.Exec(`CREATE INDEX idx_logs_admin_created ON security_logs (admin_id, created_at)`)
	DB.Exec(`CREATE INDEX idx_logs_ip_admin ON security_logs (ip_address, admin_id)`)
	log.Println("✅ Performance indexes ensured on security_logs.")

	// ── organizations table (self-service onboarding) ──
	if _, err := DB.Exec(`CREATE TABLE IF NOT EXISTS organizations (
		id INT AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		log.Fatalf("❌ Error creating organizations table: %v", err)
	}
	log.Println("✅ organizations table ready.")

	// ── Add organization_id to admins (safe to run multiple times) ──
	DB.Exec(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS organization_id INT DEFAULT NULL`)
	DB.Exec(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`)
	DB.Exec(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255) DEFAULT NULL`)
	DB.Exec(`UPDATE admins SET is_verified = TRUE WHERE email = 'admin@xrsecurity.com'`)
	log.Println("✅ admins.organization_id, is_verified, verification_token columns ensured.")

	var logCount int
	DB.QueryRow("SELECT COUNT(*) FROM security_logs").Scan(&logCount)
	if logCount == 0 {
		type seedRow struct {
			ts, level, ip, port, action, badgeText, badgeColor, identity, fp, detail string
			expandable                                                               bool
		}
		seeds := []seedRow{
			{"2024-01-30 11:46:55", "INFO", "20.0.0.5", "", "GENERATE_PROMPT", "", "", "ferycrazyones@gmail.com", "", "", false},
			{"2024-01-30 09:15:46", "INFO", "203.0.113.45", "ID", "XSS_ATTEMPT", "", "", "ferycrazyones@gmail.com", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "SELECT * FROM users WHERE id = 106", true},
			{"2024-01-30 09:15:46", "INFO", "203.0.113.45", "ID", "", "BLOCKED", "bg-red-100 text-red-600 border-red-200", "ferycrazyones@gmail.com", "", "", false},
			{"2024-01-20 00:55:15", "INFO", "10.0.0.5", "", "LOGIN", "", "", "ferycrazyones@gmail.com", "Mozilla/6.0: (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "", true},
			{"2024-01-30 06:55:15", "INFO", "10.0.0.5", "", "LOGIN", "", "", "ferycrazyones@gmail.com", "", "", false},
		}
		for _, s := range seeds {
			geo := helpers.LookupGeoIP(s.ip)
			exp := 0
			if s.expandable {
				exp = 1
			}
			DB.Exec(`INSERT INTO security_logs
				(timestamp, level, source_ip, port_id, action, badge_text, badge_color, user_identity, expandable, fingerprint, detail, country_code, country, flag)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				s.ts, s.level, s.ip, s.port, s.action, s.badgeText, s.badgeColor, s.identity, exp, s.fp, s.detail,
				geo.CountryCode, geo.Country, geo.Flag,
			)
		}
		log.Println("✅ security_logs seeded with sample data.")
	} else {
		log.Printf("✅ security_logs table ready (%d logs).", logCount)
	}
}
