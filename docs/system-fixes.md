# System Fixes Documentation

This document explains the root causes and solutions implemented to resolve several critical issues in the SaaS Cybersecurity Dashboard.

## 1. Masalah IP Duplikat di Detection Panel
**Masalah**: IP yang sama muncul berkali-kali di detection panel, membuat analisis log menjadi sulit dan membingungkan karena kurangnya uniqueness pada data ancaman.
**Penyebab**: Fungsi `HandleDetectionThreats` di backend secara langsung mengembalikan array yang berisi seluruh riwayat ancaman IP, tanpa melakukan filtering untuk mendapatkan satu record terbaru untuk setiap IP unik.
**Perbaikan**: Di dalam fungsi `HandleDetectionThreats` (di `backend/handlers/detection.go`), diimplementasikan filtering menggunakan sebuah `seenIPs` map (konsep yang setara dengan `DISTINCT` di SQL) sebelum mengirim data ke frontend. Proses ini akan merekam IP yang sudah diproses, sehingga kemunculan IP yang sama berikutnya dalam array tidak akan dimasukkan lagi, memastikan hanya ancaman terbaru untuk setiap IP yang dikirim ke Detection Panel.

## 2. Bug UI Overflow (Elemen Kuning Keluar Tabel)
**Masalah**: Elemen yang berisi payload (yang berwarna kuning/amber) keluar dari batas tabel (overflow) apabila data payload terlalu panjang, menyebabkan layout dashboard berantakan.
**Penyebab**: Elemen `<code>` pada komponen ActivityTable menggunakan class `truncate` dan struktur kontainer div yang tidak membatasi overflow string tanpa spasi secara efektif saat data sangat panjang, memaksa tabel ikut melebar.
**Perbaikan**: Diubah pada file `frontend/src/components/Dashboard.tsx`. Menambahkan constraint CSS (Tailwind) pada kontainer baris dengan `overflow-hidden` dan `w-full`. Pada teks payload itu sendiri, menghapus `truncate` dan menggantinya dengan utilitas `break-all whitespace-pre-wrap max-w-full block`. Dengan begitu, payload panjang akan otomatis terpotong menjadi beberapa baris (word wrap) alih-alih merusak batas container.

## 3. Masalah Isolasi Data (Kritis)
**Masalah**: Data security_logs di Detection Panel dan Blocked Panel tidak difilter berdasarkan `admin_id`. Akibatnya, semua tenant/admin bisa saling melihat IP dan riwayat ancaman tenant lain (masalah kebocoran data multi-tenant). Misalnya, record ancaman dengan `admin_id` = '1' muncul pada akun lain yang memiliki `admin_id` = '3'.
**Penyebab**:
1. Model dasar in-memory (`store.Threats` & `store.BlockedIPs`) tidak menyimpan atribut `admin_id`. Akibatnya, saat inisialisasi dari database, data teragregasi secara global tanpa identitas pemilik.
2. Semua handler API di backend (`HandleDetectionThreats`, `HandleGetBlocked`, `HandleBlockIP`, `HandleUnblockIP`) beroperasi pada kumpulan data global (mengambil keseluruhan elemen dari slice/map memory) tanpa memvalidasi terhadap parameter `admin_id` pengguna yang meminta.
3. Komponen React di frontend (`DetectionPanel.tsx` dan `BlockedPanel.tsx`) tidak mengirimkan informasi otorisasi (`admin_id`) yang sedang aktif ketika melakukan fetch data ancaman dan block list ke API backend.
**Perbaikan**:
1. **Model & Inisialisasi**: Menambahkan kolom `AdminID` pada struktur `ThreatRow` dan `BlockedIP` di backend (`models/models.go`). Fungsi inisialisasi `Store.LoadFromDB` juga dimodifikasi untuk menarik `admin_id` dari tabel database ke memori (diubah di `models/store.go`).
2. **Webhooks & Background Jobs**: Parameter `adminID` kini ditambahkan pada delegasi callback sistem CrowdSec Webhook dan LogWatcher, sehingga setiap entri real-time yang baru terbentuk terhubung dengan entitas yang tepat.
3. **Backend Logic Enforcement**: Memodifikasi routing API di `backend/handlers/detection.go` dan `backend/handlers/blocked.go` untuk memaksa filter komparasi antara `admin_id` milik threat/blocked IP in-memory dengan `admin_id` yang diterima dari Request Query/Body. Jika query param `admin_id` kosong, data akan difilter secara default.
4. **Frontend API Binding**: Mengubah fetch invocation di frontend (`DetectionPanel.tsx` dan `BlockedPanel.tsx`) agar selalu menarik string dari `localStorage.getItem('adminId')` dan mengkonfigurasinya sebagai query parameter `?admin_id=X` pada permintaan `GET`, dan menyertakannya di dalam JSON body saat `POST`.

**PENTING (CATATAN RESTART SERVER)**: Karena fungsi filtering beroperasi di lapisan Golang Backend, layanan / binary Go server yang sedang berjalan lama *harus direstart* (`go run .` harus dijalankan ulang). Jika backend belum direstart, binary lama yang belum berisi perbaikan *filtering rules* tersebut masih tetap merespons permintaan dan menyebabkan "bocornya" kembali data lintas admin. Hal ini sudah diselesaikan dengan me-restart proses backend.

## 4. Sidebar: Menghapus Menu "Settings"
**Masalah**: Adanya permintaan untuk menghapus menu "Settings" yang berada pada navigasi sidebar.
**Penyebab**: Konstanta `NAV_ITEMS` yang didefinisikan secara independen di berbagai halaman menggunakan komponen Sidebar statis memuat opsi navigasi ke halaman Settings.
**Perbaikan**: Menghapus item navigasi "Settings" dari variabel `NAV_ITEMS` secara komprehensif pada file komponen terkait yang menyertakan Sidebar, yaitu `Dashboard.tsx`, `DetectionPanel.tsx`, `BlockedPanel.tsx`, dan `GetApiKey.tsx`.

## 5. Implementasi JWT Token & Penutupan Celah IDOR (Kritis — SaaS Hardening)

### 5.1 Latar Belakang Masalah

Sistem sebelumnya memiliki **dua kelemahan fatal** yang membuatnya tidak layak berjalan sebagai SaaS multi-tenant:

1. **Tidak Ada Token Autentikasi (JWT)**: Backend hanya mengembalikan `adminId` sebagai angka biasa saat login. Frontend menyimpannya di `localStorage` dan mengirimnya kembali sebagai query parameter (`?admin_id=X`). Tidak ada mekanisme kriptografi yang membuktikan bahwa pengguna benar-benar terautentikasi — siapapun bisa memalsukan nilai `adminId` di browser.

2. **Insecure Direct Object Reference (IDOR)**: Karena `admin_id` dikirim sebagai query parameter URL (bukan diekstrak dari token terverifikasi), seorang penyerang (misal Dosen Budi dengan `admin_id=2`) hanya perlu mengubah URL menjadi `?admin_id=1` untuk melihat **seluruh log keamanan, ancaman, dan API key milik Dosen Andi**. Ini merupakan pelanggaran isolasi data (Data Breach) level kritis.

### 5.2 Arsitektur Solusi

```
┌──────────────┐     POST /api/auth/login      ┌──────────────────┐
│   Frontend   │  ────────────────────────────► │  Login Handler   │
│  (React)     │  ◄──── { token: "eyJhbG..." } │  (login.go)      │
└──────┬───────┘                                └──────────────────┘
       │                                              │
       │  GET /api/dashboard/stats                    │ GenerateJWT(adminID)
       │  Authorization: Bearer eyJhbG...             │
       ▼                                              ▼
┌──────────────┐     RequireAuth Middleware     ┌──────────────────┐
│   authFetch  │  ─────────────────────────────►│  JWT Validation  │
│   (auth.ts)  │                                │  (auth.go)       │
└──────────────┘                                └───────┬──────────┘
                                                        │
                                          ctx["admin_id"] = "2"
                                                        │
                                                        ▼
                                                ┌──────────────────┐
                                                │  Dashboard/API   │
                                                │  Handler         │
                                                │  GetAdminID(r)   │
                                                └──────────────────┘
                                                        │
                                          WHERE admin_id = "2"
                                                        │
                                                        ▼
                                                ┌──────────────────┐
                                                │     MySQL        │
                                                │  (security_logs) │
                                                └──────────────────┘
```

### 5.3 Perubahan Backend

#### A. File Baru: `middleware/auth.go`

File ini menambahkan tiga komponen utama:

| Komponen | Fungsi |
|---|---|
| `GenerateJWT(adminID int)` | Membuat token HS256 dengan claim `admin_id`, berlaku 24 jam. Secret diambil dari env `JWT_SECRET` (fallback: dev default). |
| `RequireAuth(next http.Handler)` | HTTP Middleware yang: (1) membaca header `Authorization: Bearer <token>`, (2) memvalidasi signature & expiry, (3) mengekstrak `admin_id` dari claims, (4) menyuntikkannya ke `context.Context`. Menolak request dengan `401` jika token tidak valid. |
| `GetAdminID(r *http.Request)` | Helper yang membaca `admin_id` dari context request. Digunakan oleh semua handler. |

#### B. Modifikasi `handlers/login.go`

- Setelah verifikasi password berhasil, memanggil `middleware.GenerateJWT(adminID)`.
- Menambahkan field `"token"` pada response JSON:
  ```json
  { "success": true, "token": "eyJhbG...", "adminId": 2, ... }
  ```

#### C. Modifikasi `handlers/register.go`

- Sama seperti login: setelah pembuatan akun berhasil, langsung menerbitkan JWT.
- User baru tidak perlu login ulang — langsung mendapat token.

#### D. Modifikasi Seluruh Handler Data (Penutupan IDOR)

Semua handler berikut diubah dari:
```go
// SEBELUM (RENTAN IDOR):
adminID := r.URL.Query().Get("admin_id")  // Bisa dipalsukan!
```
Menjadi:
```go
// SESUDAH (AMAN):
adminID := middleware.GetAdminID(r)  // Diekstrak dari JWT yang sudah diverifikasi
```

File-file yang dimodifikasi:

| File | Handler | Perubahan |
|---|---|---|
| `handlers/dashboard.go` | `HandleDashboardStats` | `admin_id` dari JWT context, bukan query param |
| `handlers/dashboard.go` | `HandleDashboardLogs` | `admin_id` dari JWT context, bukan query param |
| `handlers/detection.go` | `HandleDetectionThreats` | `admin_id` dari JWT context, bukan query param |
| `handlers/detection.go` | `HandleBlockIP` | `admin_id` dari JWT context, bukan JSON body |
| `handlers/blocked.go` | `HandleGetBlocked` | `admin_id` dari JWT context, bukan query param |
| `handlers/blocked.go` | `HandleUnblockIP` | `admin_id` dari JWT context, bukan JSON body |
| `handlers/apikeys.go` | `HandleGetAPIKeys` | `admin_id` dari JWT context, bukan query param |
| `handlers/apikeys.go` | `HandleGenerateAPIKey` | `admin_id` dari JWT context, bukan JSON body |
| `handlers/apikeys.go` | `HandleDeleteAPIKey` | `admin_id` dari JWT context, bukan query param |

#### E. Modifikasi `main.go` — Pemisahan Rute Publik & Terproteksi

```
PUBLIK (tanpa JWT):
  /api/health
  /api/auth/login
  /api/auth/register
  /api/alerts/webhook    ← Tetap publik, autentikasi via API Key

TERPROTEKSI (wajib JWT):
  /api/dashboard/*
  /api/detection/*
  /api/blocked*
  /api/apikeys*
  /api/crowdsec/*
```

Rute terproteksi dibungkus dengan `middleware.RequireAuth()` sehingga request tanpa/dengan token tidak valid langsung ditolak dengan `401 Unauthorized`.

### 5.4 Perubahan Frontend

#### A. File Baru: `utils/auth.ts`

Utilitas terpusat untuk manajemen token JWT:

| Fungsi | Kegunaan |
|---|---|
| `setToken(token)` | Menyimpan JWT ke `localStorage` |
| `getToken()` | Mengambil JWT dari `localStorage` |
| `clearToken()` | Menghapus JWT (dipanggil saat logout) |
| `authFetch(url, options)` | Wrapper `fetch()` yang **otomatis menyuntikkan** header `Authorization: Bearer <token>` ke setiap request |

#### B. Modifikasi `SignInPage.tsx`

- Pada login dan registrasi sukses, memanggil `setToken(data.token)` untuk menyimpan JWT.

#### C. Modifikasi Seluruh Komponen Dashboard

Semua komponen yang melakukan API call diubah dari:
```typescript
// SEBELUM (RENTAN IDOR):
const adminId = localStorage.getItem('adminId');
const res = await fetch(`${API}/api/...?admin_id=${adminId}`);
```
Menjadi:
```typescript
// SESUDAH (AMAN):
const res = await authFetch(`${API}/api/...`);
// admin_id otomatis ada di JWT, diekstrak di server
```

File-file yang dimodifikasi:
- `Dashboard.tsx` — stats, logs, seed
- `DetectionPanel.tsx` — threats, block IP, CrowdSec status
- `BlockedPanel.tsx` — blocked list, unblock IP
- `GetApiKey.tsx` — list, generate, delete API keys

#### D. Modifikasi `App.tsx`

- Memanggil `clearToken()` pada fungsi `handleLogout()` untuk membersihkan sesi JWT.

### 5.5 Dependency Baru

| Package | Versi | Sisi |
|---|---|---|
| `github.com/golang-jwt/jwt/v5` | v5.3.1 | Backend (Go) |

### 5.6 Catatan Produksi

> **PENTING**: Sebelum deploy ke produksi, **WAJIB** mengatur environment variable `JWT_SECRET` dengan nilai acak yang kuat (minimal 32 karakter). Nilai default hanya untuk pengembangan lokal.
>
> ```bash
> export JWT_SECRET="ganti-dengan-random-string-yang-sangat-panjang-dan-acak"
> ```

> **PENTING (RESTART SERVER)**: Karena perubahan ini menyentuh middleware routing di `main.go`, server Go backend **harus di-rebuild dan di-restart** (`go build -o mini-siem-be.exe . && .\mini-siem-be.exe`). Binary lama tidak memiliki logika JWT dan akan terus menerima request tanpa autentikasi.

