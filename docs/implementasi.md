# Mini-SIEM — Dokumentasi Implementasi

> Versi: **2.0.0**  
> Diperbarui: Agustus 2026  
> Arsitektur: Next.js 16 + Prisma + PostgreSQL + SDK Middleware

---

## Daftar Isi

1. [Arsitektur Sistem](#1-arsitektur-sistem)
2. [Komponen SDK (`minisiem-sdk`)](#2-komponen-sdk-minisiem-sdk)
3. [Scoring Engine — Filosofi Wazuh](#3-scoring-engine--filosofi-wazuh)
4. [WAF Rules & Level](#4-waf-rules--level)
5. [Score Accumulator & Decision Flow](#5-score-accumulator--decision-flow)
6. [Database Schema](#6-database-schema)
7. [API Endpoints](#7-api-endpoints)
8. [Telegram Alert Integration](#8-telegram-alert-integration)
9. [Single API Key Policy](#9-single-api-key-policy)
10. [Cara Instalasi & Penggunaan SDK](#10-cara-instalasi--penggunaan-sdk)
11. [Konfigurasi Dashboard](#11-konfigurasi-dashboard)

---

## 1. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                    APLIKASI KLIEN (Next.js)                  │
│                                                             │
│   middleware.ts                                             │
│   └── withMiniSIEM(config)                                  │
│       ├── Rate Limit Check                                  │
│       ├── WAF Detection (detectThreats)                     │
│       └── Score Accumulator → Decision (LOG/ALERT/BLOCK)    │
│                    │                                        │
│                    │ HTTP POST (Bearer API Key)              │
│                    ▼                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   MINI-SIEM DASHBOARD                        │
│                 (Next.js + PostgreSQL)                       │
│                                                             │
│  /api/detection/threats  ← Menerima log dari SDK            │
│  /api/dashboard/*        ← Data untuk UI dashboard          │
│  /api/admin/config       ← Konfigurasi threshold & Telegram │
│  /api/apikeys/*          ← Manajemen API Key                │
│                    │                                        │
│                    ├── Telegram Bot API (jika BLOCK/ALERT)  │
│                    └── Cloudflare WAF (jika BLOCK)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Komponen SDK (`minisiem-sdk`)

### Struktur File

| File | Fungsi |
|------|--------|
| `src/index.ts` | Entry point — `withMiniSIEM()` middleware wrapper |
| `src/waf.ts` | WAF rules engine + `detectThreats()` |
| `src/scoreAccumulator.ts` | Akumulasi skor per IP dalam time window |
| `src/rateLimit.ts` | Rate limiting in-memory (60 req/menit default) |
| `src/cache.ts` | Cache IP yang diblokir (TTL 60 detik) |

### Cara Penggunaan Dasar

```typescript
// middleware.ts (di aplikasi klien)
import { withMiniSIEM } from 'minisiem-sdk';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export default withMiniSIEM(
  {
    apiKey: process.env.MINISIEM_API_KEY!,
    siemUrl: process.env.MINISIEM_URL!,
    // Opsional — override threshold dari default
    blockThreshold: 10,   // Blokir jika score >= 10
    alertThreshold: 7,    // Telegram alert jika score >= 7
    scoreWindowMs: 300000 // Jendela akumulasi 5 menit
  },
  (req: NextRequest) => {
    // Middleware klien sendiri (opsional)
    return NextResponse.next();
  }
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### Environment Variables (Klien)

```env
MINISIEM_API_KEY=msiem_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MINISIEM_URL=https://your-siem-dashboard.com
```

---

## 3. Scoring Engine — Filosofi Wazuh

Mini-SIEM v2.0 mengadopsi filosofi **Wazuh Rule Level System**:

> **Tidak ada blokir instan** — setiap deteksi dinilai dengan skor, dan hanya akumulasi skor yang melampaui threshold yang memicu aksi.

### Tabel Level Scoring

| Level | Kategori | Contoh |
|-------|----------|--------|
| 0-3 | Noise / Informasi | User-Agent kosong, koneksi normal |
| 4-7 | Low-Medium | Probe `/wp-admin`, scanner terdeteksi |
| 8-11 | High | XSS, Path Traversal, NoSQL injection |
| 12-15 | Critical | SQLi, Command Injection, Log4Shell |
| 16 | Fatal (reserved) | Tidak digunakan secara otomatis |

### Keunggulan vs Rule-Based Sederhana

| Aspek | Rule-Based Lama | Scoring v2.0 |
|-------|-----------------|--------------|
| False Positive | Tinggi (langsung blokir) | Rendah (butuh akumulasi) |
| Konteks | Tidak ada | Ada (time window per IP) |
| Rule Chaining | Tidak ada | Ada (akumulasi lintas rule) |
| Konfigurasi | Hardcoded | Configurable per admin |

---

## 4. WAF Rules & Level

### Rule List Lengkap

| Rule ID | Nama | Level | Target |
|---------|------|-------|--------|
| `SQLI_001` | SQL Injection (SQLi) | 12 | url, body |
| `CMDI_001` | OS Command Injection | 13 | url, body |
| `CODE_001` | Code Injection (PHP/Node) | 13 | url, body |
| `JNDI_001` | JNDI / Log4Shell | 14 | url, body, headers, user-agent |
| `XSS_001` | Cross-Site Scripting | 8 | url, body |
| `LFI_001` | Path Traversal (LFI/RFI) | 9 | url, body |
| `NOSQL_001` | NoSQL Injection | 9 | url, body |
| `XXE_001` | XML External Entity | 10 | body |
| `SSRF_001` | Server-Side Request Forgery | 7 | url, body |
| `SCANNER_001` | Malicious Bot / Scanner | 6 | user-agent |
| `PROBE_001` | Suspicious Path Probe | 4 | url |
| `UA_001` | Empty User-Agent | 3 | user-agent |
| `PROTO_001` | Protocol Anomaly | 3 | url |

### Contoh Rule Chaining

IP `192.168.1.1` dalam 5 menit:
```
Request 1: /wp-admin           → PROBE_001 (Level 4) → Total: 4  → LOG
Request 2: /phpmyadmin         → PROBE_001 (Level 4) → Total: 8  → ALERT + Telegram
Request 3: User-Agent kosong   → UA_001    (Level 3) → Total: 11 → BLOCK + Telegram
```

---

## 5. Score Accumulator & Decision Flow

### Alur Decision

```
Request masuk
    │
    ├── Skip: /_next/*, static assets → NextResponse.next()
    │
    ├── Check: IP di-cache lokal sebagai blocked? → 403
    │
    ├── Check: Rate limit exceeded? → 429 + LOG score 8
    │
    ├── WAF Scan: detectThreats(url, headers, body)
    │     └── Return: { detected, totalScore, highestLevel, matches[] }
    │
    ├── accumulateScore(ip, events) 
    │     └── Return: { currentScore, action: LOG|ALERT|BLOCK }
    │
    ├── reportThreat → POST /api/detection/threats (async, fire-and-forget)
    │
    └── Decision:
          LOG   → pass through (NextResponse.next())
          ALERT → pass through + server-side Telegram alert
          BLOCK → cacheBlockedIP(ip) + return 403
```

### Konfigurasi Accumulator

```typescript
configureAccumulator({
  windowMs: 5 * 60 * 1000,  // 5 menit
  alertThreshold: 7,
  blockThreshold: 10,
});
```

---

## 6. Database Schema

### Model SecurityLog (v2.0 additions)

```prisma
model SecurityLog {
  // ... existing fields ...
  
  // v2.0 Scoring
  score             Int      @default(0)   // Skor event individual (highest rule level)
  accumulatedScore  Int      @default(0)   // Skor akumulasi IP saat event ini
  matchedRules      String?               // JSON: ["SQL Injection","XSS"]
  decision          String?               // LOG | ALERT | BLOCK
}
```

### Model AdminConfig (baru di v2.0)

```prisma
model AdminConfig {
  id                 Int     @id @default(autoincrement())
  adminId            Int     @unique
  admin              Admin   @relation(...)
  
  // Threshold
  blockThreshold     Int     @default(10)
  alertThreshold     Int     @default(7)
  scoreWindowMinutes Int     @default(5)
  
  // Telegram
  telegramBotToken   String?
  telegramChatId     String?
  telegramEnabled    Boolean @default(false)
}
```

---

## 7. API Endpoints

### SDK Endpoints (memerlukan API Key di header)

| Method | Path | Deskripsi |
|--------|------|-----------|
| `POST` | `/api/detection/threats` | SDK melaporkan deteksi ancaman |
| `GET` | `/api/blocked` | SDK mengambil daftar IP yang diblokir |

**Header yang diperlukan:**
```
Authorization: Bearer msiem_xxxxxxxxxxxxxxxxxxxx
```

**Payload POST `/api/detection/threats` (v2.0):**
```json
{
  "ipAddress": "185.220.101.34",
  "action": "SQL Injection (SQLi) + XSS",
  "severity": "Critical",
  "score": 20,
  "accumulatedScore": 24,
  "matchedRules": ["SQL Injection (SQLi)", "XSS"],
  "decision": "BLOCK",
  "payload": "[SQLI_001] ' OR 1=1--",
  "userAgent": "sqlmap/1.7"
}
```

### Dashboard Endpoints (memerlukan JWT token)

| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/dashboard/stats` | Statistik keseluruhan |
| `GET` | `/api/dashboard/logs` | Daftar log dengan paginasi |
| `GET` | `/api/dashboard/geo-threats` | Data ancaman untuk globe map |
| `GET` | `/api/dashboard/analytics` | Data time-series untuk charts |
| `GET/PATCH` | `/api/admin/config` | Konfigurasi threshold & Telegram |
| `POST` | `/api/admin/telegram-test` | Test koneksi Telegram |
| `GET` | `/api/apikeys` | Daftar API Key (masked) |
| `POST` | `/api/apikeys/generate` | Generate API Key baru |
| `DELETE` | `/api/apikeys/delete?id=` | Hapus API Key |

---

## 8. Telegram Alert Integration

### Cara Setup

1. Buat bot baru via [@BotFather](https://t.me/BotFather) di Telegram, dapatkan **Bot Token**
2. Kirim pesan ke bot, lalu buka `https://api.telegram.org/bot<TOKEN>/getUpdates` untuk mendapatkan **Chat ID**
3. Masukkan keduanya di dashboard → menu **Alerts**
4. Klik **"Test Alert"** untuk memverifikasi koneksi

### Format Pesan Alert

```
🚫 Mini-SIEM Alert

IP: `185.220.101.34`
Decision: BLOCK
Accumulated Score: 12 / 10
Severity: Critical
Matched Rules:
  • SQL Injection (SQLi)
  • XSS
Time (WIB): 17/08/2026, 10.30.00
```

### Kapan Alert Dikirim

| Kondisi | Alert Terkirim? |
|---------|-----------------|
| `decision = LOG` | ❌ Tidak |
| `decision = ALERT` | ✅ Ya (jika Telegram dikonfigurasi) |
| `decision = BLOCK` | ✅ Ya (jika Telegram dikonfigurasi) |

---

## 9. Single API Key Policy

> **Satu sistem hanya boleh menggunakan SATU API Key yang aktif.**

Hal ini bertujuan untuk:
- **Mencegah bentrok record** di database (log dari dua sumber tidak bisa dibedakan)
- **Kejelasan akuntabilitas** — setiap log jelas berasal dari satu deployment
- **Keamanan** — mengurangi attack surface jika key bocor

### Enforcement

```
POST /api/apikeys/generate
→ Cek: apakah admin sudah punya key aktif?
  → Ya: Return HTTP 409 dengan pesan error
  → Tidak: Generate key baru (format: msiem_<48 hex chars>)
```

### Alur yang Direkomendasikan

1. Generate API Key baru
2. **Simpan key segera** — tidak ditampilkan ulang setelah halaman ditutup
3. Masukkan ke environment variable aplikasi klien
4. Jika key bocor: hapus di dashboard → generate baru → update env var

---

## 10. Cara Instalasi & Penggunaan SDK

### Opsi A: Instalasi dari Path Lokal (Development)

```bash
# Di direktori aplikasi klien
npm install /path/to/minisiem-sdk
```

### Opsi B: Instalasi dari NPM (Production)

```bash
npm install minisiem-sdk
```

### Konfigurasi Lengkap `middleware.ts`

```typescript
import { withMiniSIEM } from 'minisiem-sdk';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export default withMiniSIEM(
  {
    // Wajib
    apiKey: process.env.MINISIEM_API_KEY!,
    siemUrl: process.env.MINISIEM_URL!,
    
    // Opsional — akan diambil dari AdminConfig di dashboard jika tidak diset
    blockThreshold: 10,
    alertThreshold: 7,
    scoreWindowMs: 5 * 60 * 1000, // 5 menit
  },
  async (req: NextRequest) => {
    // Logika middleware aplikasi klien (opsional)
    return NextResponse.next();
  }
);

export const config = {
  // Proteksi semua route kecuali static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 11. Konfigurasi Dashboard

### Menu Sidebar

| Menu | Deskripsi |
|------|-----------|
| **Monitoring** | Dashboard utama: Globe Map, Live Logs, Analytics Charts |
| **Detection** | Tabel deteksi ancaman dengan breakdown skor |
| **Blocked IPs** | Daftar IP yang diblokir + tombol unblock |
| **Alerts** | Konfigurasi Telegram + histori alert |
| **API Key** | Manajemen API Key (max 1 aktif) |

### Konfigurasi Scoring Threshold

Akses melalui **Dashboard → Alerts → Scoring Settings**:

| Parameter | Default | Deskripsi |
|-----------|---------|-----------|
| Block Threshold | 10 | Skor akumulasi untuk blokir IP otomatis |
| Alert Threshold | 7 | Skor akumulasi untuk kirim notifikasi |
| Time Window | 5 menit | Jendela waktu penghitungan akumulasi |

> **Panduan:** Untuk environment dengan trafik tinggi dan banyak false positive (forum, marketplace), naikkan `blockThreshold` ke 12-14. Untuk environment sensitif (sistem keuangan, admin panel), turunkan ke 6-8.

---

*Dokumentasi ini di-generate secara otomatis. Untuk pertanyaan, buka issue di repository.*
