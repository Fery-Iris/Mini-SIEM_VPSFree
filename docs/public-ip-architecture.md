# Public IP Architecture — Dual-IP SIEM Design

> Mini-SIEM | Dual-IP Architecture for VM/NAT Lab Environments

---

## 1. Architecture Overview

The Mini-SIEM system stores **two separate IPs** for every security event:

| Field | Column | Purpose | Example |
|-------|--------|---------|---------|
| **Private IP** | `ip_address` | Blocking, firewall rules, SIEM mitigation | `192.168.56.101` |
| **Public IP** | `ip_address_public` | GeoIP lookup, country flag, globe visualization | `103.28.xx.xx` |

### Why Two IPs?

In a **VM/NAT lab environment**, the attacker VM (e.g., Kali Linux) has a private IP like `192.168.56.101`. This IP is:
- ✅ **Valid for blocking** — the firewall/CrowdSec bouncer can block it
- ❌ **Useless for GeoIP** — private IPs have no geographical location

The public IP represents the **NAT gateway's external IP** — the IP that the attacker's traffic would appear as when exiting to the internet.

---

## 2. How Public IP Discovery Works

### Flow Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Attacker VM     │     │  Target VM        │     │  Mini-SIEM Backend  │
│  192.168.56.101  │────>│  Apache/DVWA      │────>│  LogWatcher /       │
│  (Kali Linux)    │     │  192.168.56.1     │     │  CrowdSec Webhook   │
└─────────────────┘     └──────────────────┘     └────────┬────────────┘
                                                          │
                                                          ▼
                                              ┌──────────────────────┐
                                              │  ResolvePublicIP()   │
                                              │                      │
                                              │  Is IP private?      │
                                              │  ├── YES → discover  │
                                              │  │   gateway public  │
                                              │  │   IP via external │
                                              │  │   service         │
                                              │  └── NO → use as-is │
                                              └──────────┬───────────┘
                                                         │
                                          ┌──────────────┼──────────────┐
                                          ▼              ▼              ▼
                                   ┌────────────┐ ┌───────────┐ ┌────────────┐
                                   │ ip_address  │ │ip_address │ │  GeoIP     │
                                   │ (private)   │ │_public    │ │  Lookup    │
                                   │ for blocking│ │for GeoIP  │ │  (lat/lng) │
                                   └────────────┘ └───────────┘ └────────────┘
```

### Step-by-Step Process

1. **Attack occurs**: Attacker VM (`192.168.56.101`) sends malicious request to target
2. **Detection**: LogWatcher parses Apache access.log or CrowdSec sends webhook alert
3. **Private IP captured**: The source IP from the log/alert is stored as `ip_address`
4. **Public IP resolution**:
   - `helpers.ResolvePublicIP(privateIP)` is called
   - Function checks if IP is private (RFC1918/RFC6598)
   - If private → queries external IP discovery service to get the gateway's public IP
   - If already public → returns it as-is
5. **Storage**: Both IPs are stored in `security_logs`
6. **GeoIP**: The public IP is used for `lat`/`lng` lookup via `ip-api.com`
7. **Globe**: Frontend renders the threat at the correct geographic location

---

## 3. Public IP Discovery Services

The backend uses multiple external services for redundancy:

| Service | URL | Method |
|---------|-----|--------|
| ipify | `https://api.ipify.org` | Returns plain text IP |
| ifconfig.me | `https://ifconfig.me/ip` | Returns plain text IP |
| icanhazip | `https://icanhazip.com` | Returns plain text IP |
| AWS Checkip | `https://checkip.amazonaws.com` | Returns plain text IP |

### How External Discovery Works

```
Backend Server ──HTTP GET──> api.ipify.org
                                │
                                ▼
                         "What is my IP?"
                                │
                                ▼
                    api.ipify.org sees the request
                    coming from the NAT gateway's
                    public IP (e.g., 103.28.xx.xx)
                                │
                                ▼
                    Returns: "103.28.xx.xx"
```

This is the **same mechanism** that real-world tools use:
- When your browser visits `whatismyip.com`, it shows your router's public IP
- The SIEM does the same thing programmatically
- All VMs behind the same NAT gateway share the same public exit IP

### Caching

- Gateway public IP is cached with a **5-minute TTL**
- Prevents excessive external API calls
- Handles dynamic IPs (DHCP/ISP changes) by refreshing periodically

---

## 4. NAT Limitations & Constraints

### What NAT Means for This Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    NAT Gateway / Router                  │
│                                                         │
│  Internal Network          │        Internet            │
│  192.168.56.0/24          │                             │
│                           │                             │
│  ┌──────────────┐         │    ┌──────────────────┐     │
│  │ Kali VM      │ ────NAT────> │ Public Internet  │     │
│  │ .56.101      │         │    │ Sees: 103.28.x.x │     │
│  └──────────────┘         │    └──────────────────┘     │
│  ┌──────────────┐         │                             │
│  │ Target VM    │         │                             │
│  │ .56.1        │         │                             │
│  └──────────────┘         │                             │
│                           │                             │
└─────────────────────────────────────────────────────────┘
```

### Key Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| **All VMs share one public IP** | In a lab, all attackers appear from the same public IP on the globe | This is realistic — in real attacks behind NAT, the SIEM sees the NAT gateway IP too |
| **Host-Only network has no internet** | If VMs are on a Host-Only adapter, there's no gateway to discover | Backend gracefully returns empty public IP; globe skips plotting |
| **ISP dynamic IP changes** | Public IP may change after router restart | 5-minute cache TTL ensures refreshed data |
| **Rate limiting on discovery APIs** | ipify/ifconfig.me may rate-limit | Multiple fallback services + caching minimizes requests |

### Real-World Comparison

In production environments, this limitation doesn't exist because:
- Attackers' traffic arrives with their **real public IP** (or their proxy/VPN exit IP)
- The SIEM directly sees the public IP in the logs
- No resolution needed — `ip_address` and `ip_address_public` would be the same

The dual-IP architecture supports **both** scenarios seamlessly.

---

## 5. Why NOT Hardcoded Mapping

We explicitly **do not** use any of these anti-patterns:

### ❌ Static IP Map (Rejected)
```go
// WRONG — This is fake data, not a real network flow
var publicIPMap = map[string]string{
    "192.168.56.101": "103.28.50.12",
    "192.168.56.102": "45.76.182.55",
}
```
**Why rejected**: This is not a real network process. The mapping is arbitrary and doesn't reflect actual network topology. A new attacker VM would have no mapping.

### ❌ Random/Dummy IPs (Rejected)
```go
// WRONG — Random IPs are meaningless
publicIP := fmt.Sprintf("%d.%d.%d.%d", rand.Intn(256), ...)
```
**Why rejected**: Random IPs point to random locations. The globe would show nonsensical data with no relation to reality.

### ❌ Hardcoded GeoIP (Rejected)
```go
// WRONG — Hardcoded coordinates bypass the entire GeoIP system
lat, lng := 37.7749, -122.4194 // Always shows San Francisco
```
**Why rejected**: Defeats the purpose of GeoIP. The teacher's requirement is that the **GeoIP library itself** determines the location.

### ✅ What We Actually Do (Correct)

```go
// CORRECT — Real network discovery
publicIP := helpers.ResolvePublicIP(privateIP)  // Discovers real gateway IP
geo := helpers.LookupGeoIP(publicIP)            // Real GeoIP lookup
// lat/lng come from ip-api.com based on REAL IP
```

This approach:
- Uses a **real network process** (external IP discovery)
- The public IP is **discovered, not assigned**
- GeoIP resolves from a **real, routable IP address**
- The location shown on the globe reflects the **actual geographic location** of the network's internet exit point

---

## 6. Database Schema

### `security_logs` Table — Relevant Columns

```sql
-- Private IP: the internal/VM IP that attacked
ip_address VARCHAR(50) NOT NULL,

-- Public IP: the NAT gateway's external IP (for GeoIP)
ip_address_public VARCHAR(50) DEFAULT NULL,

-- GeoIP data (resolved from public IP)
country_code VARCHAR(10),
country VARCHAR(100),
flag VARCHAR(20),
```

### Example Row

| ip_address | ip_address_public | country_code | country |
|-----------|------------------|-------------|---------|
| 192.168.56.101 | 103.28.50.12 | ID | Indonesia |
| 10.0.0.5 | 103.28.50.12 | ID | Indonesia |
| 45.33.32.156 | 45.33.32.156 | US | United States |

> Note: When the source IP is already public (row 3), both columns contain the same IP.

---

## 7. Full SIEM + GeoIP Visualization Flow

```
Attack Flow:
═══════════════════════════════════════════════════════════

    Kali VM                    Target VM              Backend
  192.168.56.101           192.168.56.1            localhost:8081
       │                        │                        │
       │── HTTP attack ────────>│                        │
       │   (XSS/SQLi/etc)      │                        │
       │                        │── Apache logs ────────>│
       │                        │   IP: 192.168.56.101   │
       │                        │                        │
       │                        │                   ┌────┴────────────┐
       │                        │                   │  LogWatcher     │
       │                        │                   │  detects attack │
       │                        │                   └────┬────────────┘
       │                        │                        │
       │                        │               ┌────────┴─────────┐
       │                        │               │ ResolvePublicIP  │
       │                        │               │ 192.168.56.101   │
       │                        │               │ → Is private?    │
       │                        │               │   YES            │
       │                        │               │ → Query ipify    │
       │                        │               │ → Got: 103.28.x  │
       │                        │               └────────┬─────────┘
       │                        │                        │
       │                        │               ┌────────┴─────────┐
       │                        │               │ LookupGeoIP      │
       │                        │               │ 103.28.x.x       │
       │                        │               │ → Country: ID    │
       │                        │               │ → Lat: -6.175    │
       │                        │               │ → Lng: 106.845   │
       │                        │               └────────┬─────────┘
       │                        │                        │
       │                        │               ┌────────┴──────────────┐
       │                        │               │ INSERT security_logs  │
       │                        │               │ ip_address: .56.101   │
       │                        │               │ ip_public: 103.28.x   │
       │                        │               │ country: ID           │
       │                        │               └────────┬──────────────┘
       │                        │                        │
       │                        │                        │
       │                        │                   Frontend
       │                        │                   Dashboard
       │                        │                        │
       │                        │               ┌────────┴──────────┐
       │                        │               │ Globe renders     │
       │                        │               │ dot at (-6.2,     │
       │                        │               │ 106.8) = Jakarta  │
       │                        │               │                   │
       │                        │               │ Table shows:      │
       │                        │               │ IP: 192.168.56.101│
       │                        │               │ Flag: 🇮🇩          │
       │                        │               └───────────────────┘


Blocking Flow (uses private IP):
═════════════════════════════════
  Dashboard "Block IP" → POST /api/detection/block { ip: "192.168.56.101" }
                       → UPDATE security_logs SET is_blocked=1 WHERE ip_address='192.168.56.101'
                       → cscli decisions add -i 192.168.56.101 -t ban
                       → Windows Firewall blocks 192.168.56.101
```

---

## 8. Files Modified

| File | Change |
|------|--------|
| `helpers/publicip.go` | **NEW** — Public IP resolver with RFC1918 detection, external discovery, caching |
| `helpers/geoip.go` | Added `Lat`, `Lng` fields to `GeoIPResult`; queries `lat,lon` from ip-api.com |
| `models/models.go` | Added `PublicIP`, `Lat`, `Lng` to `ThreatRow` |
| `models/store.go` | `LoadFromDB` now queries `ip_address_public` and uses it for GeoIP |
| `database/database.go` | Migration: `ALTER TABLE security_logs ADD COLUMN ip_address_public` |
| `crowdsec/webhook.go` | `AddThreat` callback includes `publicIP`; inserts into `ip_address_public` |
| `crowdsec/logwatcher.go` | Resolves public IP before DB insert; passes to `AddThreat` |
| `main.go` | Updated `AddThreat` callback to accept + store `publicIP` |
| `handlers/blocked.go` | Unblock handler restores `PublicIP` + GeoIP on threats |
| `frontend/.../DetectionPanel.tsx` | Added `publicIp` to `ThreatRow` interface |

---

## 9. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_WATCHER_ADMIN` | `1` | Admin ID for LogWatcher-detected threats |
| `LAPI_DEFAULT_ADMIN` | `1` | Admin ID for LAPI-polled threats |
| `APACHE_LOG_PATH` | `C:\xampp\apache\logs\access.log` | Path to Apache access log |

No new environment variables were added for the public IP feature — it works automatically.
