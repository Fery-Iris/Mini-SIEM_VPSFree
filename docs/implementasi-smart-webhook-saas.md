# Implementasi Smart Webhook Mapping — SaaS Multi-Tenant

> **Tanggal Implementasi**: 5 Mei 2026  
> **Status**: ✅ Selesai  
> **Klasifikasi**: Kritikal — Isolasi Data Tenant pada Jalur Ingest

---

## 1. Masalah Sebelumnya

### 1.1 Webhook Tanpa Identitas Pemilik

Ketika CrowdSec (atau sistem deteksi lain) mengirim alert serangan ke endpoint webhook:

```
POST /api/alerts/webhook
Authorization: Bearer xr_live_abc123def456
```

Backend **hanya** mengecek apakah API Key tersebut **ada dan aktif**:

```go
// ❌ SEBELUMNYA — hanya cek keberadaan, BUKAN pemilik
var exists int
db.QueryRow("SELECT COUNT(*) FROM api_keys WHERE Key_value = ? AND Is_active = 1", apiKey).Scan(&exists)
if exists == 0 {
    // tolak
}
```

Setelah validasi, backend menyimpan semua serangan ke `security_logs` dengan **`admin_id = 1` yang di-hardcode**:

```go
// ❌ SEBELUMNYA — hardcoded admin_id = 1
db.Exec(`INSERT INTO security_logs (admin_id, ...) VALUES (?, ...)`, 1, ...)
```

### 1.2 Dampak

| Skenario | Hasil |
|---|---|
| Dosen Andi (`admin_id=1`) generate API Key `xr_live_AAA` | ✅ Serangan masuk ke laci Dosen Andi |
| Dosen Budi (`admin_id=2`) generate API Key `xr_live_BBB` | ❌ **Serangan tetap masuk ke laci Dosen Andi (admin_id=1)** |
| Dosen Cici (`admin_id=3`) generate API Key `xr_live_CCC` | ❌ **Serangan tetap masuk ke laci Dosen Andi (admin_id=1)** |

Akibatnya:
- Dashboard Dosen Budi **kosong** (padahal serangannya banyak)
- Dashboard Dosen Andi **membengkak** (berisi serangan semua orang)
- SaaS **tidak fungsional** untuk klien selain admin pertama

---

## 2. Solusi: Smart Webhook Mapping

### 2.1 Konsep

```
                    ┌─────────────────────────────────────────────────────┐
                    │          POST /api/alerts/webhook                    │
                    │          Authorization: Bearer xr_live_BBB          │
                    └─────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────────────────────────────┐
                    │  Step 1: Ekstrak API Key dari Header                │
                    │  apiKey = "xr_live_BBB"                            │
                    └─────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────────────────────────────┐
                    │  Step 2: "Hei Database, API Key ini milik siapa?"  │
                    │                                                     │
                    │  SELECT Admin_id FROM api_keys                      │
                    │  WHERE Key_value = 'xr_live_BBB'                   │
                    │  AND Is_active = 1                                  │
                    │                                                     │
                    │  Database menjawab: "Milik Dosen Budi (Admin ID: 2)"│
                    └─────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────────────────────────────┐
                    │  Step 3: Parse Alert Payload dari CrowdSec          │
                    │  [{ "scenario": "crowdsecurity/http-xss-probing",   │
                    │     "source": { "ip": "10.0.0.5" }, ... }]         │
                    └─────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────────────────────────────┐
                    │  Step 4: Simpan dengan admin_id = 2                 │
                    │                                                     │
                    │  INSERT INTO security_logs                          │
                    │    (admin_id, action, ip_address, ...)              │
                    │  VALUES (2, 'XSS_Attempt', '10.0.0.5', ...)        │
                    │                                                     │
                    │  + AddThreat("2", "XSS (CrowdSec)", ...)           │
                    │  + AddBlocked("2", "10.0.0.5", ...)                │
                    └─────────────────────────────────────────────────────┘
```

### 2.2 Hasil Setelah Fix

| Skenario | Hasil |
|---|---|
| Webhook dengan API Key milik Dosen Andi (`admin_id=1`) | ✅ Serangan masuk ke laci Dosen Andi |
| Webhook dengan API Key milik Dosen Budi (`admin_id=2`) | ✅ Serangan masuk ke laci Dosen Budi |
| Webhook dengan API Key milik Dosen Cici (`admin_id=3`) | ✅ Serangan masuk ke laci Dosen Cici |
| Webhook dengan API Key yang tidak valid | 🚫 Ditolak dengan `401 Unauthorized` |

---

## 3. Perubahan Kode

### 3.1 `handlers/crowdsec_handler.go` — Webhook Handler

**Perubahan Inti**: Query validasi API Key diubah dari `SELECT COUNT(*)` menjadi `SELECT Admin_id` sehingga dalam satu query, kita mendapatkan dua informasi sekaligus:
1. Apakah API Key valid dan aktif?
2. Siapa pemiliknya?

```diff
- // ❌ SEBELUMNYA: Hanya cek keberadaan
- var exists int
- db.QueryRow("SELECT COUNT(*) FROM api_keys WHERE Key_value = ? AND Is_active = 1", apiKey).Scan(&exists)
- if exists == 0 { ... }

+ // ✅ SESUDAH: Cek keberadaan DAN pemilik sekaligus
+ var ownerAdminID int
+ err := db.QueryRow(
+     "SELECT Admin_id FROM api_keys WHERE Key_value = ? AND Is_active = 1",
+     apiKey,
+ ).Scan(&ownerAdminID)
+ if err != nil {
+     // API key tidak ditemukan atau tidak aktif → tolak
+ }
+ adminIDStr := strconv.Itoa(ownerAdminID)
```

Lalu `adminIDStr` diteruskan ke `ProcessWebhookAlerts`:

```diff
- newCount := crowdsec.ProcessWebhookAlerts(alerts, cb)
+ newCount := crowdsec.ProcessWebhookAlerts(alerts, cb, adminIDStr)
```

**Fitur Tambahan**:
- Log mapping ditampilkan di terminal: `🔑 Webhook Smart Mapping: API Key ...def456 → Admin ID: 2`
- Response JSON menyertakan `adminId` untuk transparansi
- `HandleCrowdSecStatus` juga di-scope per admin (hanya menampilkan jumlah alert milik admin yang sedang login)

### 3.2 `crowdsec/webhook.go` — ProcessWebhookAlerts

**Perubahan**: Fungsi sekarang menerima parameter `adminID string` dan menggunakannya di tiga titik:

```diff
- func ProcessWebhookAlerts(alerts []Alert, cb WebhookCallbacks) int {
+ func ProcessWebhookAlerts(alerts []Alert, cb WebhookCallbacks, adminID string) int {
```

| Titik Penggunaan | Sebelum | Sesudah |
|---|---|---|
| `INSERT INTO security_logs (admin_id, ...)` | Hardcoded `1` | `adminID` dari parameter |
| `cb.AddThreat(adminID, ...)` | Hardcoded `"1"` | `adminID` dari parameter |
| `cb.AddBlocked(adminID, ...)` | Hardcoded `"1"` | `adminID` dari parameter |

### 3.3 `crowdsec/logwatcher.go` — LogWatcher

**Perubahan**: Struct `LogWatcher` mendapat field `AdminID` baru yang dikonfigurasi via environment variable `LOG_WATCHER_ADMIN` (default: `"1"`).

```diff
  type LogWatcher struct {
      LogPath    string
+     AdminID    string
      DB         *sql.DB
      ...
  }
```

Semua penggunaan hardcoded `1` dan `"1"` diganti dengan `lw.AdminID`.

### 3.4 `main.go` — LAPI Background Poller

**Perubahan**: Poller sekarang menggunakan `LAPI_DEFAULT_ADMIN` environment variable (default: `"1"`):

```diff
+ lapiAdminID := "1"
+ if v := os.Getenv("LAPI_DEFAULT_ADMIN"); v != "" {
+     lapiAdminID = v
+ }
  go func() {
-     count := crowdsec.ProcessWebhookAlerts(alerts, cb)
+     count := crowdsec.ProcessWebhookAlerts(alerts, cb, lapiAdminID)
  }()
```

---

## 4. Tiga Jalur Ingest & Konfigurasi Admin ID

Mini SIEM memiliki tiga jalur masuknya data serangan. Berikut cara masing-masing jalur menentukan `admin_id`:

| Jalur Ingest | Sumber Data | Cara Menentukan `admin_id` |
|---|---|---|
| **Webhook** (`/api/alerts/webhook`) | CrowdSec HTTP Plugin / external system | ✅ **Smart Mapping**: Lookup `Admin_id` dari tabel `api_keys` berdasarkan API Key di header |
| **LAPI Poller** (background goroutine) | CrowdSec LAPI langsung | 🔧 Environment variable `LAPI_DEFAULT_ADMIN` (default: `1`) |
| **LogWatcher** (Apache access.log tail) | File log Apache lokal | 🔧 Environment variable `LOG_WATCHER_ADMIN` (default: `1`) |

> **Catatan**: Webhook adalah satu-satunya jalur yang mendukung multi-tenant secara penuh secara otomatis, karena setiap klien SaaS mengirim serangan menggunakan API Key unik mereka sendiri. LAPI Poller dan LogWatcher adalah fitur deteksi lokal yang umumnya hanya digunakan oleh operator sistem (admin utama).

---

## 5. Alur End-to-End SaaS

Berikut alur lengkap dari perspektif klien baru:

```
1. Klien → Buka website → Klik "Daftar"
   └─ POST /api/auth/register
   └─ Backend membuat: organizations + admins (admin_id: 5)
   └─ Response: { token: "eyJ...", adminId: 5, ... }

2. Klien → Login ke Dashboard → Klik "Generate API Key"
   └─ POST /api/apikeys/generate (JWT: admin_id=5)
   └─ Backend membuat: api_keys (Admin_id: 5, Key_value: "xr_live_XYZ...")
   └─ Response: { key: "xr_live_XYZ..." }

3. Klien → Konfigurasi CrowdSec HTTP Plugin:
   ┌───────────────────────────────────────────────┐
   │ url: https://siem.example.com/api/alerts/webhook │
   │ headers:                                         │
   │   Authorization: "Bearer xr_live_XYZ..."        │
   └───────────────────────────────────────────────┘

4. CrowdSec mendeteksi serangan XSS dari 10.0.0.5
   └─ POST /api/alerts/webhook
      Authorization: Bearer xr_live_XYZ...
      Body: [{ scenario: "crowdsecurity/http-xss-probing", ... }]

5. Backend menerima webhook:
   └─ Step 1: Ekstrak API Key = "xr_live_XYZ..."
   └─ Step 2: SELECT Admin_id FROM api_keys WHERE Key_value = ?
              → Jawaban: Admin ID = 5
   └─ Step 3: Parse alert payload
   └─ Step 4: INSERT INTO security_logs (admin_id=5, ...)
              + AddThreat("5", ...)
              + AddBlocked("5", ...)

6. Klien → Buka Dashboard
   └─ GET /api/dashboard/stats (JWT: admin_id=5)
   └─ Backend: WHERE admin_id = 5
   └─ Klien hanya melihat serangan MILIKNYA SENDIRI ✅
```

---

## 6. Ringkasan File yang Dimodifikasi

| File | Jenis Perubahan |
|---|---|
| `handlers/crowdsec_handler.go` | Smart Mapping: lookup `Admin_id` dari API Key, teruskan ke processor |
| `crowdsec/webhook.go` | `ProcessWebhookAlerts` menerima parameter `adminID`, tidak lagi hardcode |
| `crowdsec/logwatcher.go` | Struct `LogWatcher.AdminID` dari env `LOG_WATCHER_ADMIN` |
| `main.go` | LAPI Poller menggunakan env `LAPI_DEFAULT_ADMIN` |

---

## 7. Environment Variables Baru

| Variable | Default | Digunakan Oleh | Keterangan |
|---|---|---|---|
| `LAPI_DEFAULT_ADMIN` | `"1"` | Background LAPI Poller | Admin ID untuk alert yang di-poll langsung dari CrowdSec LAPI |
| `LOG_WATCHER_ADMIN` | `"1"` | Apache LogWatcher | Admin ID untuk attack yang terdeteksi dari file access.log lokal |

> Webhook **tidak memerlukan** environment variable karena admin_id selalu di-resolve secara dinamis dari API Key.

---

## 8. Catatan Penting

> **RESTART BACKEND WAJIB**: Setelah perubahan ini, backend Go harus di-rebuild dan di-restart:
> ```bash
> cd Backend
> go build -o mini-siem-be.exe .
> .\mini-siem-be.exe
> ```
> Binary lama tidak memiliki logika Smart Mapping dan akan terus menulis semua serangan ke `admin_id=1`.

> **BACKWARD COMPATIBLE**: API Key yang sudah ada di database tetap berfungsi. Selama field `Admin_id` pada tabel `api_keys` terisi dengan benar (yang memang sudah demikian sejak implementasi registrasi SaaS), Smart Mapping akan langsung berjalan tanpa migrasi data tambahan.
