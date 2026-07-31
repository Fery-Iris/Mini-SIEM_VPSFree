package helpers

import (
	"encoding/json"
	"net/http"
	"sync"
)

type GeoIPResult struct {
	CountryCode string
	Country     string
	Flag        string
	Lat         float64
	Lng         float64
}

var geoIPCache = map[string]GeoIPResult{}
var geoIPMu sync.RWMutex

func CountryCodeToFlag(code string) string {
	if len(code) != 2 {
		return "🌐"
	}
	r1 := rune(code[0]-'A') + 0x1F1E6
	r2 := rune(code[1]-'A') + 0x1F1E6
	return string([]rune{r1, r2})
}

func LookupGeoIP(ip string) GeoIPResult {
	// Detect private/local IPs without calling external API
	if ip == "127.0.0.1" || ip == "::1" || ip == "localhost" {
		return GeoIPResult{CountryCode: "LO", Country: "Localhost", Flag: "🏠", Lat: 0, Lng: 0}
	}
	if len(ip) >= 3 && ip[:3] == "10." {
		return GeoIPResult{CountryCode: "LO", Country: "Local Network", Flag: "🏠", Lat: 0, Lng: 0}
	}
	if len(ip) >= 8 && ip[:8] == "192.168." {
		return GeoIPResult{CountryCode: "LO", Country: "Local Network", Flag: "🏠", Lat: 0, Lng: 0}
	}
	if len(ip) >= 7 && ip[:7] == "172.16." {
		return GeoIPResult{CountryCode: "LO", Country: "Local Network", Flag: "🏠", Lat: 0, Lng: 0}
	}
	if len(ip) >= 5 && ip[:5] == "20.0." {
		return GeoIPResult{CountryCode: "LO", Country: "Local Network", Flag: "🏠", Lat: 0, Lng: 0}
	}

	geoIPMu.RLock()
	if cached, ok := geoIPCache[ip]; ok {
		geoIPMu.RUnlock()
		return cached
	}
	geoIPMu.RUnlock()

	resp, err := http.Get("http://ip-api.com/json/" + ip + "?fields=countryCode,country,lat,lon,status")
	if err != nil {
		return GeoIPResult{CountryCode: "?", Country: "Unknown", Flag: "🌐", Lat: 0, Lng: 0}
	}
	defer resp.Body.Close()

	var apiResp struct {
		Status      string  `json:"status"`
		CountryCode string  `json:"countryCode"`
		Country     string  `json:"country"`
		Lat         float64 `json:"lat"`
		Lon         float64 `json:"lon"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil || apiResp.Status != "success" {
		return GeoIPResult{CountryCode: "?", Country: "Unknown", Flag: "🌐", Lat: 0, Lng: 0}
	}

	result := GeoIPResult{
		CountryCode: apiResp.CountryCode,
		Country:     apiResp.Country,
		Flag:        CountryCodeToFlag(apiResp.CountryCode),
		Lat:         apiResp.Lat,
		Lng:         apiResp.Lon,
	}

	geoIPMu.Lock()
	geoIPCache[ip] = result
	geoIPMu.Unlock()

	return result
}
