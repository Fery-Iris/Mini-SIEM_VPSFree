# Dokumentasi Integrasi IPS Firewall — CrowdSec × Mini-SIEM

> **Versi**: 1.0  
> **Terakhir diperbarui**: 16 April 2026  
> **Cakupan**: Alur data CrowdSec IPS → Backend Go → Frontend React (Detection Panel & Blocked Panel)

---

## 1. Arsitektur Aliran Data

```
┌─────────────────────┐
│   CrowdSec LAPI     │  ← Mendeteksi serangan (XSS, SQLi, Brute Force, dll.)
│  (Local API)        │
└────────┬────────────┘
         │ HTTP POST (Webhook)
         ▼
┌─────────────────────────────────────────────────────┐
│              Backend Go (:8081)                      │
│                                                      │
│  POST /api/alerts/webhook                            │
│   ├─ Validasi API Key (Bearer Token)                 │
│   ├─ Parse array of CrowdSec Alerts                  │
│   ├─ resolveAttackType() → mapping scenario → action │
│   ├─ buildAlertPayload() → JSON payload              │
│   ├─ MapSeverity() → Critical/High/Medium/Low        │
│   ├─ INSERT INTO security_logs (MySQL/SQLite)        │
│   └─ AddThreat() → update in-memory Store            │
│                                                      │
│  GET /api/detection/threats  → return Store.Threats   │
│  GET /api/blocked            → return Store.BlockedIPs│
│  POST /api/detection/block   → tambah BlockedIP       │
│  POST /api/blocked/unblock   → hapus BlockedIP        │
│  GET /api/crowdsec/status    → status koneksi LAPI    │
└────────┬────────────────────────────────────────────┘
         │ HTTP GET/POST (REST API)
         ▼
┌─────────────────────────────────────────────────────┐
│          Frontend React (Vite :5173)                 │
│                                                      │
│  DetectionPanel.tsx                                  │
│   ├─ Polling GET /api/detection/threats (10 detik)   │
│   ├─ Polling GET /api/crowdsec/status   (10 detik)   │
│   ├─ Render ThreatTable (tabel deteksi)              │
│   ├─ Render LiveThreatViz (globe 3D)                 │
│   └─ Block IP → POST /api/detection/block            │
│                                                      │
│  BlockedPanel.tsx                                    │
│   ├─ Polling GET /api/blocked           (10 detik)   │
│   ├─ Render tabel IP yang diblokir                   │
│   └─ Unblock IP → POST /api/blocked/unblock          │
└─────────────────────────────────────────────────────┘
```

---

## 2. Endpoint API Utama

### 2.1. Webhook — Menerima Alert dari CrowdSec

| Field     | Nilai                              |
|-----------|------------------------------------|
| **Method**    | `POST`                         |
| **Path**      | `/api/alerts/webhook`          |
| **Auth**      | `Authorization: Bearer <API_KEY>` |
| **Handler**   | `handlers.HandleCrowdSecWebhook()` |
| **Processor** | `crowdsec.ProcessWebhookAlerts()` |

**Alur pemrosesan:**
1. Validasi header `Authorization` (Bearer token)
2. Cek API Key aktif di tabel `api_keys`
3. Parse body JSON sebagai `[]crowdsec.Alert`
4. Untuk setiap alert:
   - Deduplikasi via `crowdsec_alert_id` (menyaring payload yang sudah pernah diproses)
   - `resolveAttackType(scenario)` → mapping ke action & label
   - `buildAlertPayload()` → buat JSON payload dengan patterns matched
   - `MapSeverity()` → tentukan severity berdasarkan decision type / event count
   - INSERT ke tabel `security_logs` (termasuk is_blocked=1 jika ada ban decision)
   - `cb.AddThreat()` → update array in-memory `Store.Threats` untuk Detection Panel
   - **Auto-Block IP** (`cb.AddBlocked()`) → jika CrowdSec mengirim decision "ban", maka IP tersebut langsung dimasukkan ke in-memory `Store.BlockedIPs` agar seketika muncul di Blocked Panel.

### 2.2. Detection Threats — Data untuk Detection Panel

| Field     | Nilai                              |
|-----------|------------------------------------|
| **Method**    | `GET`                          |
| **Path**      | `/api/detection/threats`       |
| **Handler**   | `handlers.HandleDetectionThreats()` |
| **Response**  | `{ "threats": [...] }`        |

### 2.3. Block IP — Blokir IP dari Detection Panel

| Field     | Nilai                              |
|-----------|------------------------------------|
| **Method**    | `POST`                         |
| **Path**      | `/api/detection/block`         |
| **Body**      | `{ "ip": "x.x.x.x" }`        |
| **Handler**   | `handlers.HandleBlockIP()`     |

### 2.4. Blocked List — Data untuk Blocked Panel

| Field     | Nilai                              |
|-----------|------------------------------------|
| **Method**    | `GET`                          |
| **Path**      | `/api/blocked`                 |
| **Handler**   | `handlers.HandleGetBlocked()`  |
| **Response**  | `{ "blocked": [...] }`        |

### 2.5. Unblock IP — Hapus IP dari Blocked List

| Field     | Nilai                              |
|-----------|------------------------------------|
| **Method**    | `POST`                         |
| **Path**      | `/api/blocked/unblock`         |
| **Body**      | `{ "ip": "x.x.x.x" }`        |
| **Handler**   | `handlers.HandleUnblockIP()`   |

### 2.6. CrowdSec Status — Status Koneksi

| Field     | Nilai                              |
|-----------|------------------------------------|
| **Method**    | `GET`                          |
| **Path**      | `/api/crowdsec/status`         |
| **Handler**   | `handlers.HandleCrowdSecStatus()` |

---

## 3. Contoh Payload JSON

### 3.1. Webhook Input (CrowdSec → Backend)

```json
[
  {
    "id": 42,
    "created_at": "2026-04-16T13:21:00+07:00",
    "scenario": "crowdsecurity/http-xss-probing",
    "scenario_version": "1.0",
    "message": "Ip 192.168.1.12 performed crowdsecurity/http-xss-probing",
    "events_count": 6,
    "source": {
      "ip": "192.168.1.12",
      "range": "",
      "scope": "ip",
      "value": "192.168.1.12",
      "cn": "ID"
    },
    "start_at": "2026-04-16T13:20:00+07:00",
    "stop_at": "2026-04-16T13:21:00+07:00",
    "decisions": [
      {
        "duration": "4h",
        "type": "ban",
        "scope": "ip",
        "value": "192.168.1.12",
        "origin": "crowdsec"
      }
    ],
    "events": [
      {
        "timestamp": "2026-04-16T13:20:30+07:00",
        "meta": [
          { "key": "http_args", "value": "q=<script>alert(1)</script>" },
          { "key": "http_path", "value": "/search" },
          { "key": "http_user_agent", "value": "Mozilla/5.0 ..." }
        ]
      }
    ],
    "simulated": false
  }
]
```

### 3.2. Response: GET /api/detection/threats

```json
{
  "threats": [
    {
      "attackType": "XSS (CrowdSec)",
      "sourceIp": "192.168.1.12",
      "severity": "Critical",
      "latestUpdate": "Detected 13:21"
    },
    {
      "attackType": "Brute Force (CrowdSec)",
      "sourceIp": "203.0.113.5",
      "severity": "High",
      "latestUpdate": "Detected 13:10"
    }
  ]
}
```

### 3.3. Response: GET /api/blocked

```json
{
  "blocked": [
    {
      "ip": "192.168.1.12",
      "blockedAt": "13:21"
    },
    {
      "ip": "203.0.113.5",
      "blockedAt": "13:10"
    }
  ]
}
```

### 3.4. Response: GET /api/crowdsec/status

```json
{
  "connected": true,
  "lapi_url": "http://localhost:8080",
  "machine_id": "mini-siem-machine",
  "alerts_stored": 15,
  "scenarios": [
    "crowdsecurity/http-xss-probing",
    "crowdsecurity/http-bf-wordpress-bf",
    "crowdsecurity/http-generic-bf",
    "crowdsecurity/http-bad-user-agent",
    "crowdsecurity/http-path-traversal-probing",
    "crowdsecurity/http-open-proxy",
    "crowdsecurity/http-generic-exploit",
    "crowdsecurity/http-cve-probing",
    "crowdsecurity/http-sqli-probing"
  ]
}
```

### 3.5. Request: POST /api/detection/block

```json
{ "ip": "192.168.1.12" }
```

**Response:**
```json
{
  "message": "IP 192.168.1.12 blocked",
  "blocked": {
    "ip": "192.168.1.12",
    "blockedAt": "13:25"
  }
}
```

### 3.6. Request: POST /api/blocked/unblock

```json
{ "ip": "192.168.1.12" }
```

**Response:**
```json
{ "message": "IP 192.168.1.12 unblocked" }
```

---

## 4. Mapping Scenario CrowdSec → Attack Type

| CrowdSec Scenario | Action (DB) | Label (Frontend) |
|---|---|---|
| `crowdsecurity/http-xss-probing` | `XSS_Attempt` | XSS (CrowdSec) |
| `crowdsecurity/http-bf-wordpress-bf` | `Brute_Force` | Brute Force (CrowdSec) |
| `crowdsecurity/http-generic-bf` | `Brute_Force` | Brute Force (CrowdSec) |
| `crowdsecurity/http-bad-user-agent` | `Brute_Force` | Brute Force (CrowdSec) |
| `crowdsecurity/http-path-traversal-probing` | `File_Inclusion` | File Inclusion (CrowdSec) |
| `crowdsecurity/http-open-proxy` | `File_Inclusion` | File Inclusion (CrowdSec) |
| `crowdsecurity/http-generic-exploit` | `Command_Injection` | Command Injection (CrowdSec) |
| `crowdsecurity/http-cve-probing` | `Command_Injection` | Command Injection (CrowdSec) |
| `crowdsecurity/http-sqli-probing` | `SQL_Injection` | SQL Injection (CrowdSec) |

---

## 5. Mapping Severity

Severity ditentukan oleh fungsi `MapSeverity()` di `crowdsec/client.go`:

| Kondisi | Severity |
|---|---|
| Decision type = `ban` | **Critical** |
| Decision type = `captcha` | **High** |
| Decision type = `throttle` | **Medium** |
| Events count ≥ 10 (tanpa decision) | **Critical** |
| Events count ≥ 5 (tanpa decision) | **High** |
| Fallback | **Medium** |

---

## 6. Struktur Data In-Memory Store

Store di-*hydrate* dari database saat startup melalui `Store.LoadFromDB()` dan diperbarui secara real-time saat webhook alert masuk.

### ThreatRow (models/models.go)

```go
type ThreatRow struct {
    AttackType   string `json:"attackType"`    // e.g. "XSS (CrowdSec)"
    SourceIP     string `json:"sourceIp"`      // e.g. "192.168.1.12"
    Severity     string `json:"severity"`      // Critical/High/Medium/Low
    LatestUpdate string `json:"latestUpdate"`  // e.g. "Detected 13:21"
}
```

### BlockedIP (models/models.go)

```go
type BlockedIP struct {
    IP        string `json:"ip"`                    // e.g. "192.168.1.12"
    BlockedAt string `json:"blockedAt"`             // e.g. "13:21"
    Highlight bool   `json:"highlight,omitempty"`   // UI highlight flag
}
```

---

## 7. Frontend Variable Mapping

### DetectionPanel.tsx

| Frontend Variable | API Field | Deskripsi |
|---|---|---|
| `threats[].attackType` | `threats[].attackType` | Tipe serangan (label) |
| `threats[].sourceIp` | `threats[].sourceIp` | IP sumber serangan |
| `threats[].severity` | `threats[].severity` | Tingkat keparahan |
| `threats[].latestUpdate` | `threats[].latestUpdate` | Waktu terakhir terdeteksi |
| `csStatus.connected` | `connected` | Status koneksi CrowdSec LAPI |
| `csStatus.alerts_stored` | `alerts_stored` | Jumlah alert tersimpan |

### BlockedPanel.tsx

| Frontend Variable | API Field | Deskripsi |
|---|---|---|
| `blockedIps[].ip` | `blocked[].ip` | IP yang diblokir |
| `blockedIps[].blockedAt` | `blocked[].blockedAt` | Waktu pemblokiran |
| `blockedIps[].highlight` | `blocked[].highlight` | Flag highlight UI |

---

## 8. File Referensi

| File | Lokasi | Fungsi |
|---|---|---|
| `crowdsec/webhook.go` | Backend | Proses webhook alert, pattern matching, insert DB |
| `crowdsec/client.go` | Backend | Client LAPI, tipe data Alert, mapping severity |
| `crowdsec/config.go` | Backend | Konfigurasi koneksi CrowdSec |
| `handlers/detection.go` | Backend | Handler GET threats, POST block |
| `handlers/blocked.go` | Backend | Handler GET blocked, POST unblock |
| `handlers/crowdsec_handler.go` | Backend | Handler status & webhook |
| `models/store.go` | Backend | In-memory store + LoadFromDB hydration |
| `models/models.go` | Backend | Definisi struct ThreatRow, BlockedIP |
| `main.go` | Backend | Routing, inisialisasi store & webhook callbacks |
| `components/DetectionPanel.tsx` | Frontend | Panel deteksi threat real-time |
| `components/BlockedPanel.tsx` | Frontend | Panel IP yang diblokir |
| `crowdsec/*.txt` | Backend | File pola pattern per attack type |
