package helpers

import (
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ─────────────────────────── Public IP Resolution ───────────────────────────
//
// In a VM/NAT lab environment, attack traffic originates from private IPs
// (e.g. 192.168.56.101) which have no GeoIP data. This module resolves the
// public/external IP that the NAT gateway exposes to the internet.
//
// Architecture:
//   private_ip (ip_address)        → used for blocking/firewall/SIEM mitigation
//   public_ip  (ip_address_public) → used for GeoIP lookup & globe visualization
//
// How it works:
//   1. If the incoming IP is already public → use it directly (no resolution needed)
//   2. If the incoming IP is private/NAT   → query external discovery services
//      to find the public IP of the gateway that this network exits through
//
// This is the same mechanism real-world SIEM/SOC tools use: when traffic
// arrives from a private RFC1918 address behind NAT, the SIEM queries the
// network's egress IP for geolocation context.

var (
	// cachedGatewayPublicIP stores the discovered gateway public IP.
	// In a NAT environment, all private IPs share the same gateway exit IP.
	cachedGatewayPublicIP string
	gatewayIPMu           sync.RWMutex
	gatewayIPLastRefresh  time.Time

	// Gateway IP is refreshed every 5 minutes to handle dynamic IPs (DHCP/ISP changes)
	gatewayIPTTL = 5 * time.Minute
)

// publicIPServices lists external services that return the caller's public IP.
// Multiple services provide redundancy if one is down.
var publicIPServices = []string{
	"https://api.ipify.org",
	"https://ifconfig.me/ip",
	"https://icanhazip.com",
	"https://checkip.amazonaws.com",
}

// IsPrivateIP checks whether an IP address belongs to a private/reserved range
// (RFC1918, RFC6598, loopback, link-local).
func IsPrivateIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	// Check standard private ranges
	privateRanges := []struct {
		network string
	}{
		{"10.0.0.0/8"},       // RFC1918 Class A
		{"172.16.0.0/12"},    // RFC1918 Class B
		{"192.168.0.0/16"},   // RFC1918 Class C
		{"100.64.0.0/10"},    // RFC6598 Carrier-grade NAT
		{"127.0.0.0/8"},      // Loopback
		{"169.254.0.0/16"},   // Link-local
		{"::1/128"},          // IPv6 loopback
		{"fc00::/7"},         // IPv6 unique local
		{"fe80::/10"},        // IPv6 link-local
	}

	for _, r := range privateRanges {
		_, cidr, err := net.ParseCIDR(r.network)
		if err != nil {
			continue
		}
		if cidr.Contains(ip) {
			return true
		}
	}
	return false
}

// ResolvePublicIP determines the public IP to use for GeoIP/visualization.
//
// Flow:
//   1. If the IP is already public (routable) → return it as-is
//   2. If the IP is private (NAT/VM) → discover the gateway's public IP
//      by querying external IP discovery services
//
// This mirrors real-world network flow: when an attacker behind NAT sends
// traffic, the target sees the NAT gateway's public IP. In a lab environment
// where the target is on the same private network, we simulate this by
// discovering what public IP the gateway would expose.
func ResolvePublicIP(privateIP string) string {
	// If the IP is already public, no resolution needed
	if !IsPrivateIP(privateIP) {
		return privateIP
	}

	// For private IPs, discover the gateway's public (egress) IP
	return discoverGatewayPublicIP()
}

// discoverGatewayPublicIP queries external services to find the public IP
// of the NAT gateway. Results are cached with a TTL to avoid excessive
// external API calls.
func discoverGatewayPublicIP() string {
	gatewayIPMu.RLock()
	if cachedGatewayPublicIP != "" && time.Since(gatewayIPLastRefresh) < gatewayIPTTL {
		ip := cachedGatewayPublicIP
		gatewayIPMu.RUnlock()
		return ip
	}
	gatewayIPMu.RUnlock()

	// Try each external service until one responds
	client := &http.Client{Timeout: 5 * time.Second}

	for _, svc := range publicIPServices {
		resp, err := client.Get(svc)
		if err != nil {
			log.Printf("⚠️  PublicIP: %s failed: %v", svc, err)
			continue
		}

		body, err := io.ReadAll(io.LimitReader(resp.Body, 64))
		resp.Body.Close()
		if err != nil || resp.StatusCode != http.StatusOK {
			log.Printf("⚠️  PublicIP: %s returned status %d", svc, resp.StatusCode)
			continue
		}

		ip := strings.TrimSpace(string(body))
		if net.ParseIP(ip) == nil {
			log.Printf("⚠️  PublicIP: %s returned invalid IP: %q", svc, ip)
			continue
		}

		// Cache the result
		gatewayIPMu.Lock()
		cachedGatewayPublicIP = ip
		gatewayIPLastRefresh = time.Now()
		gatewayIPMu.Unlock()

		log.Printf("🌐 PublicIP: Gateway public IP discovered via %s → %s", svc, ip)
		return ip
	}

	// All services failed — return empty string (GeoIP will show "Unknown")
	log.Println("❌ PublicIP: All external IP discovery services failed")
	return ""
}
