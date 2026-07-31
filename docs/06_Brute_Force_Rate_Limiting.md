# Dokumentasi: Brute Force Rate Limiting

Dokumen ini menjelaskan mekanisme **Rate Limiting** pada deteksi serangan Brute Force di Mini-SIEM. Perubahan ini menggantikan deteksi berbasis *single-visit* yang sebelumnya langsung memblokir IP saat mengakses halaman login, menjadi deteksi berbasis **anomali kecepatan akses**.

## Latar Belakang Masalah

### Sebelumnya (Versi Lama)
Sistem sebelumnya mendeteksi brute force hanya berdasarkan **pattern matching** terhadap path login:

```
Satu kali akses ke /login.php → Langsung terdeteksi → IP di-ban 4 jam
```

**Masalah utama:**
- Admin yang login normal juga ikut ter-ban karena mengakses `/login.php`
- Tidak ada pembedaan antara akses normal dan serangan otomatis
- Pola kamus (`bruteforce_patterns.txt`) hanya dicocokkan terhadap User-Agent, bukan URL/body
- **False positive sangat tinggi** — satu kunjungan ke halaman login sudah cukup untuk trigger

### Sesudahnya (Versi Sekarang)
Deteksi sekarang menggunakan **Sliding Window Rate Limiter**:

```
IP mengakses login path ≥ 5 kali dalam 30 detik → Baru terdeteksi sebagai Brute Force
```

## Algoritma Deteksi (2 Tahap)

### Tahap 1: Deteksi User-Agent Mencurigakan (Instan)
Pola dari kamus `bruteforce_patterns.txt` dicocokkan terhadap **User-Agent** dari request HTTP. Jika terdeteksi (misalnya tool `Hydra`, `sqlmap`, `python-requests`), IP **langsung** ditandai sebagai Brute Force **tanpa perlu rate limiting**.

> **Rasionalitas:** Tool serangan otomatis memiliki *signature* yang unik di User-Agent. Jika terdeteksi, tidak perlu menunggu frekuensi tinggi — keberadaan tool itu sendiri sudah merupakan anomali.

### Tahap 2: Rate Limiting (Berbasis Frekuensi)
Jika User-Agent normal (browser biasa), sistem memeriksa dua kriteria:

#### (a) Request path mengarah ke login endpoint

| Login Path | Contoh Aplikasi |
|-----------|----------------|
| `/wp-login` | WordPress |
| `/wp-admin` | WordPress Admin |
| `/admin/login` | Custom CMS |
| `/auth/login` | API Auth |
| `/login.php` | DVWA, PHP Apps |
| `/signin` | Modern Web Apps |

#### (b) Query string mengandung parameter autentikasi
Jika path tidak cocok dengan login endpoint, sistem juga memeriksa apakah **query string** mengandung parameter autentikasi:

| Parameter | Variasi yang Dideteksi |
|-----------|------------------------|
| Username  | `username=`, `user=` |
| Password  | `password=`, `passwd=`, `pass=` |

Kedua parameter (`username` **DAN** `password`) harus ada secara bersamaan. Ini menangkap halaman seperti:
- **DVWA Brute Force:** `/DVWA-master/vulnerabilities/brute/?username=admin&password=test&Login=Login`
- Form login GET-based lainnya

Sistem kemudian mencatat **timestamp** akses per IP dan menghitung berapa kali IP tersebut mengirim request dalam **sliding window** (default: 30 detik).

```
┌─────────── Sliding Window (30 detik) ───────────┐
│                                                  │
│  [req1] [req2] [req3] [req4] [req5] ← TRIGGER!  │
│   0s     2s     5s     8s    12s                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Brute Force hanya ter-trigger jika jumlah request ≥ threshold (default: 5) dalam window.**

## Konfigurasi

Rate limiter dapat dikonfigurasi melalui **environment variables**:

| Env Variable | Default | Deskripsi |
|-------------|---------|-----------|
| `BF_THRESHOLD` | `5` | Jumlah minimum request ke login path untuk trigger deteksi |
| `BF_WINDOW_SEC` | `30` | Ukuran sliding window dalam detik |

### Contoh Konfigurasi (`.env`)

```bash
# Default: 5 request dalam 30 detik
BF_THRESHOLD=5
BF_WINDOW_SEC=30

# Lebih ketat: 3 request dalam 20 detik
BF_THRESHOLD=3
BF_WINDOW_SEC=20

# Lebih longgar: 10 request dalam 60 detik
BF_THRESHOLD=10
BF_WINDOW_SEC=60
```

## Skenario Pengujian

### ✅ Admin Login Normal (TIDAK Ter-block)
```
Admin mengakses /DVWA-master/login.php 1x → Counter: 1/5 → AMAN
Admin memasukkan username 'admin' password '12345678' → Counter: 2/5 → AMAN
Admin refresh halaman → Counter: 3/5 → AMAN
```
**Hasil:** Tidak terdeteksi, tidak di-ban. Admin bisa login dengan normal.

### 🔴 Brute Force dengan Hydra (Ter-block via User-Agent)
```
Hydra mengirim request dengan User-Agent: "Hydra/9.0"
→ Tahap 1: User-Agent cocok dengan pattern kamus
→ LANGSUNG terdeteksi tanpa rate limiting
→ IP di-ban 4 jam
```

### 🔴 Brute Force dengan Burp Suite Intruder (Ter-block via Rate Limiting)
```
Burp Suite Intruder menembak DVWA brute force page:
  GET /DVWA-master/vulnerabilities/brute/?username=admin&password=§payload§&Login=Login

User-Agent: Mozilla/5.0 (normal browser) → Tidak cocok dengan kamus
→ Query string mengandung username= DAN password= → Masuk rate limiter
→ Request 1-4: Counter naik, belum trigger (4/5)
→ Request ke-5: Counter = 5/5 → TRIGGER! Brute Force terdeteksi
→ IP 192.168.56.101 di-ban 4 jam via Windows Firewall
```

### 🔴 Brute Force dengan Script Otomatis (Ter-block via Rate Limiting)
```
Script mengirim 10 request ke /login.php dalam 5 detik
→ Path /login.php cocok dengan loginPaths → Masuk rate limiter
→ Request 1-4: Counter naik, belum trigger (4/5)
→ Request ke-5: Counter = 5/5 → TRIGGER! Brute Force terdeteksi
→ IP di-ban 4 jam
```

## Manajemen Memori

Sistem menggunakan **background goroutine** yang berjalan setiap **5 menit** untuk membersihkan data rate limiter yang sudah kadaluarsa (`startBFCleanup`). IP yang tidak lagi memiliki catatan akses dalam window akan dihapus dari memori.

## Payload Contoh (Setelah Perubahan)

```json
{
  "scenario": "crowdsecurity/http-bf-wordpress-bf",
  "attack_type": "Brute_Force",
  "message": "Detected Brute Force (CrowdSec) attack from 192.168.56.101",
  "source_ip": "192.168.56.101",
  "request_path": "/DVWA-master/login.php",
  "decoded_url": "/DVWA-master/login.php",
  "user_agent": "Mozilla/5.0 ...",
  "patterns_matched": ["/login.php (rate: 7/30s)"],
  "timestamp": "26/May/2026:08:02:42 +0800",
  "decisions": ["ban:Ip(192.168.56.101)"]
}
```

Perhatikan bahwa `patterns_matched` sekarang menyertakan informasi **rate** (`7/30s` = 7 request dalam 30 detik) sehingga admin bisa melihat seberapa agresif serangan tersebut.

## File yang Diubah

| File | Perubahan |
|------|-----------|
| `Backend/crowdsec/logwatcher.go` | Menambahkan sliding window rate limiter, `recordAndCount()`, `startBFCleanup()`, konfigurasi env var |

## Referensi Terkait

- [02_LogWatcher_Engine.md](./02_LogWatcher_Engine.md) — Dokumentasi mekanisme LogWatcher
- [04_Skenario_Pengujian_TA.md](./04_Skenario_Pengujian_TA.md) — Skenario pengujian serangan
