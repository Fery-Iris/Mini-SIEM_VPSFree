package crowdsec

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

// Client manages authenticated communication with the CrowdSec LAPI.
type Client struct {
	cfg       Config
	token     string
	tokenExp  time.Time
	mu        sync.Mutex
	client    *http.Client
	connected bool
}

// NewClient creates a new client but does NOT connect yet.
func NewClient(cfg Config) *Client {
	return &Client{
		cfg: cfg,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Config returns the configuration (used for status checks).
func (c *Client) Config() Config {
	return c.cfg
}

// IsConnected returns true if we have a valid JWT token.
func (c *Client) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected && time.Now().Before(c.tokenExp)
}

// Login authenticates as a Machine to obtain a JWT token.
func (c *Client) Login() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	body := map[string]string{
		"machine_id": c.cfg.MachineID,
		"password":   c.cfg.Password,
	}
	jsonBody, _ := json.Marshal(body)

	url := c.cfg.LAPIURL + "/v1/watchers/login"
	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		c.connected = false
		return fmt.Errorf("crowdsec login request build: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		c.connected = false
		return fmt.Errorf("crowdsec LAPI unreachable (%s): %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		c.connected = false
		return fmt.Errorf("crowdsec login failed (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var loginResp struct {
		Code   int    `json:"code"`
		Expire string `json:"expire"`
		Token  string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&loginResp); err != nil {
		c.connected = false
		return fmt.Errorf("crowdsec login response decode: %w", err)
	}

	c.token = loginResp.Token
	// Parse expiry; CrowdSec returns RFC3339
	if t, err := time.Parse(time.RFC3339, loginResp.Expire); err == nil {
		c.tokenExp = t
	} else {
		// Default: valid for 1 hour
		c.tokenExp = time.Now().Add(1 * time.Hour)
	}
	c.connected = true
	log.Printf("✅ CrowdSec LAPI authenticated (token valid until %s)", c.tokenExp.Format("15:04:05"))
	return nil
}

// ensureToken refreshes the JWT if it's expired or missing.
func (c *Client) ensureToken() error {
	if c.IsConnected() {
		return nil
	}
	return c.Login()
}

// ─────────────────────────── Alert Types ───────────────────────────

// Alert represents a parsed alert from the CrowdSec LAPI.
type Alert struct {
	ID              int        `json:"id"`
	CreatedAt       string     `json:"created_at"`
	Scenario        string     `json:"scenario"`
	ScenarioVersion string     `json:"scenario_version"`
	Message         string     `json:"message"`
	EventsCount     int        `json:"events_count"`
	Source          Source     `json:"source"`
	StartAt         string     `json:"start_at"`
	StopAt          string     `json:"stop_at"`
	Decisions       []Decision `json:"decisions"`
	Events          []Event    `json:"events"`
	Simulated       bool       `json:"simulated"`
}

type Source struct {
	IP    string `json:"ip"`
	Range string `json:"range"`
	Scope string `json:"scope"`
	Value string `json:"value"`
	CN    string `json:"cn"`
}

type Decision struct {
	Duration string `json:"duration"`
	Type     string `json:"type"`
	Scope    string `json:"scope"`
	Value    string `json:"value"`
	Origin   string `json:"origin"`
}

type Event struct {
	Timestamp string `json:"timestamp"`
	Meta      []Meta `json:"meta"`
}

type Meta struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// ─────────────────────────── Fetch Alerts ───────────────────────────

// FetchAlertsByScenario queries the CrowdSec LAPI for alerts triggered by a specific scenario.
func (c *Client) FetchAlertsByScenario(scenario string) ([]Alert, error) {
	if err := c.ensureToken(); err != nil {
		return nil, err
	}

	c.mu.Lock()
	token := c.token
	c.mu.Unlock()

	url := c.cfg.LAPIURL + "/v1/alerts?scenario=" + scenario
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("crowdsec LAPI request failed: %w", err)
	}
	defer resp.Body.Close()

	// If unauthorized, re-login once and retry
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		log.Println("⚠️  CrowdSec token expired, re-authenticating...")
		if err := c.Login(); err != nil {
			return nil, err
		}
		c.mu.Lock()
		token = c.token
		c.mu.Unlock()

		req2, _ := http.NewRequest("GET", url, nil)
		req2.Header.Set("Authorization", "Bearer "+token)
		resp, err = c.client.Do(req2)
		if err != nil {
			return nil, fmt.Errorf("crowdsec retry failed: %w", err)
		}
		defer resp.Body.Close()
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("crowdsec alerts query HTTP %d: %s", resp.StatusCode, string(body))
	}

	var alerts []Alert
	if err := json.NewDecoder(resp.Body).Decode(&alerts); err != nil {
		return nil, fmt.Errorf("decode alerts: %w", err)
	}

	return alerts, nil
}

// FetchXSSAlerts is a convenience wrapper for fetching XSS probing alerts.
func (c *Client) FetchXSSAlerts() ([]Alert, error) {
	return c.FetchAlertsByScenario("crowdsecurity/http-xss-probing")
}

// FetchAllAlerts queries the CrowdSec LAPI for alerts across all supported scenarios.
func (c *Client) FetchAllAlerts() ([]Alert, error) {
	var all []Alert
	for _, scenario := range SupportedScenarios() {
		alerts, err := c.FetchAlertsByScenario(scenario)
		if err != nil {
			log.Printf("⚠️  Error fetching alerts for %s: %v", scenario, err)
			continue
		}
		all = append(all, alerts...)
	}
	return all, nil
}

// ─────────────────────────── Helper ───────────────────────────

// ExtractMeta extracts a value from event meta by key.
func ExtractMeta(metas []Meta, key string) string {
	for _, m := range metas {
		if m.Key == key {
			return m.Value
		}
	}
	return ""
}

// MapSeverity maps CrowdSec decision type to a severity string for our SIEM.
func MapSeverity(alert Alert) string {
	// All attacks are considered critical severity
	return "Critical"
}
