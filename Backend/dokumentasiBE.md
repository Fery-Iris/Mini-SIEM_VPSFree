# Dokumentasi Backend — Mini SIEM

## Struktur Folder

````
Backend/
├── main.go                      # Entry point: inisialisasi server & routing
├── go.mod / go.sum               # Go module & dependencies
│
├── database/
│   └── database.go               # Koneksi MySQL, pembuatan tabel, data seed
│
├── models/
│   ├── models.go                 # Definisi struct (LogEntry, ThreatRow, StatCard, dll)
│   └── store.go                  # In-memory store (threats, blocked IPs)
│
├── helpers/
│   ├── json.go                   # WriteJSON, ReadJSON, GenerateAPIKey
│   └── geoip.go                  # GeoIP lookup + cache + CountryCodeToFlag
│
├── middleware/
│   └── cors.go                   # CORS middleware
│
├── handlers/
│   ├── health.go                 # GET  /api/health
│   ├── login.go                  # POST /api/auth/login
│   ├── dashboard.go              # GET  /api/dashboard/stats & /logs, POST /logs/seed
│   ├── detection.go              # GET  /api/detection/threats, POST /api/detection/block
│   ├── blocked.go                # GET  /api/blocked, POST /api/blocked/unblock
│   ├── apikeys.go                # GET  /api/apikeys, POST /generate, DELETE /delete
│   └── crowdsec_handler.go       # GET  /api/crowdsec/status, POST /api/alerts/webhook
│
└── crowdsec/                     # Package CrowdSec (client, config, webhook processor)
    ├── client.go
    ├── config.go
    ├── webhook.go
    └── xss_probe_patterns.txt
```

## Cara Menjalankan Aplikasi

### Prasyarat

- **Go** ≥ 1.21
- **MySQL** (via XAMPP atau standalone) berjalan di `127.0.0.1:3306`
- User `root` tanpa password (default XAMPP)

### Langkah-langkah

```bash
# 1. Masuk ke folder Backend
cd Backend

# 2. Download dependencies
go mod tidy

# 3. Jalankan server
go run .
```

Server akan berjalan di **`http://localhost:8081`**.

## Daftar Endpoint

| Method   | Endpoint                   | Deskripsi                                   | Handler File                   |
| -------- | -------------------------- | ------------------------------------------- | ------------------------------ |
| `GET`    | `/api/health`              | Health check (status: ok)                   | `handlers/health.go`           |
| `POST`   | `/api/auth/login`          | Login admin (email + password)              | `handlers/login.go`            |
| `GET`    | `/api/dashboard/stats`     | Statistik dashboard (attacks, threats, IPs) | `handlers/dashboard.go`        |
| `GET`    | `/api/dashboard/logs`      | Log keamanan dengan paginasi (?page&limit)  | `handlers/dashboard.go`        |
| `POST`   | `/api/dashboard/logs/seed` | Seed 5 dummy log ke database                | `handlers/dashboard.go`        |
| `GET`    | `/api/detection/threats`   | Daftar ancaman aktif                        | `handlers/detection.go`        |
| `POST`   | `/api/detection/block`     | Blokir IP (body: `{"ip":"..."}`)            | `handlers/detection.go`        |
| `GET`    | `/api/blocked`             | Daftar IP yang diblokir                     | `handlers/blocked.go`          |
| `POST`   | `/api/blocked/unblock`     | Hapus blokir IP (body: `{"ip":"..."}`)      | `handlers/blocked.go`          |
| `GET`    | `/api/apikeys`             | Daftar semua API key                        | `handlers/apikeys.go`          |
| `POST`   | `/api/apikeys/generate`    | Generate API key baru                       | `handlers/apikeys.go`          |
| `DELETE` | `/api/apikeys/delete?id=X` | Hapus API key berdasarkan ID                | `handlers/apikeys.go`          |
| `GET`    | `/api/crowdsec/status`     | Status koneksi CrowdSec                     | `handlers/crowdsec_handler.go` |
| `POST`   | `/api/alerts/webhook`      | Webhook CrowdSec (autentikasi Bearer token) | `handlers/crowdsec_handler.go` |

## Mapping Handler ↔ Frontend

| Handler File            | Frontend Component   |
| ----------------------- | -------------------- |
| `handlers/login.go`     | `Login.tsx`          |
| `handlers/dashboard.go` | `Dashboard.tsx`      |
| `handlers/detection.go` | `DetectionPanel.tsx` |
| `handlers/blocked.go`   | `BlockedPanel.tsx`   |
| `handlers/apikeys.go`   | `GetApiKey.tsx`      |
