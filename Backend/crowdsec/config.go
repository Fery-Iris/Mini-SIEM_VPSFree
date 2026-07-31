package crowdsec

import "os"

// Config holds the connection parameters for CrowdSec LAPI.
type Config struct {
	LAPIURL   string // e.g. http://127.0.0.1:8080
	MachineID string
	Password  string
}

// LoadConfig reads configuration from environment variables with sensible defaults.
func LoadConfig() Config {
	cfg := Config{
		LAPIURL:   "http://127.0.0.1:8080",
		MachineID: "mini-siem",
		Password:  "MiniSiem2026!",
	}
	if v := os.Getenv("CROWDSEC_LAPI_URL"); v != "" {
		cfg.LAPIURL = v
	}
	if v := os.Getenv("CROWDSEC_MACHINE_ID"); v != "" {
		cfg.MachineID = v
	}
	if v := os.Getenv("CROWDSEC_PASSWORD"); v != "" {
		cfg.Password = v
	}
	return cfg
}
