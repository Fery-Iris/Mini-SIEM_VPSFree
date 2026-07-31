package models

// LogEntry matches the actual security_logs table schema
type LogEntry struct {
	ID           int    `json:"id"`
	AdminID      string `json:"adminId,omitempty"`
	UserIdentity string `json:"userIdentity"`
	Action       string `json:"action"`
	Payload      string `json:"payload,omitempty"`
	Severity     string `json:"severity"`
	IPAddress    string `json:"ipAddress"`
	CountryCode  string `json:"countryCode,omitempty"`
	UserAgent    string `json:"userAgent,omitempty"`
	IsBlocked    bool   `json:"isBlocked"`
	CreatedAt    string `json:"createdAt"`
	// Computed
	Flag    string `json:"flag,omitempty"`
	Country string `json:"country,omitempty"`
}

type Badge struct {
	Text  string `json:"text"`
	Color string `json:"color"`
}

type ThreatRow struct {
	AdminID      string  `json:"adminId,omitempty"`
	AttackType   string  `json:"attackType"`
	SourceIP     string  `json:"sourceIp"`      // Private/internal IP — used for blocking
	PublicIP     string  `json:"publicIp"`       // Public/external IP — used for GeoIP & globe
	Severity     string  `json:"severity"`
	LatestUpdate string  `json:"latestUpdate"`
	CountryCode  string  `json:"countryCode"`
	Country      string  `json:"country"`
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
}

type BlockedIP struct {
	AdminID   string `json:"adminId,omitempty"`
	IP        string `json:"ip"`
	BlockedAt string `json:"blockedAt"`
	Highlight bool   `json:"highlight,omitempty"`
}

type APIKeyEntry struct {
	ID        int    `json:"id"`
	AdminID   int    `json:"adminId"`
	KeyValue  string `json:"key"`
	IsActive  int    `json:"isActive"`
	CreatedAt string `json:"created"`
}

type StatCard struct {
	Label     string `json:"label"`
	Value     string `json:"value"`
	Change    string `json:"change"`
	Sub       string `json:"sub"`
	Icon      string `json:"icon"`
	IconBg    string `json:"iconBg"`
	IconColor string `json:"iconColor"`
	ChangeBg  string `json:"changeBg"`
}
