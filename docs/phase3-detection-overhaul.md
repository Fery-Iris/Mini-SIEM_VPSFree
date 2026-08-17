# Phase 3 — Detection Panel Overhaul & Sidebar Rework

> **Status:** Siap dieksekusi  
> **Estimasi:** Perubahan besar pada 2 file utama + 1 API endpoint baru

---

## Kondisi Saat Ini (Before)

DetectionPanel saat ini memiliki beberapa **keterbatasan** yang perlu diperbaiki:

| Aspek | Kondisi Sekarang | Target |
|-------|-----------------|--------|
| **Tema** | Light mode (bg putih, slate-50) | Dark mode konsisten dengan Dashboard |
| **Data Scoring** | ❌ Tidak tampil — field `score`, `accumulatedScore`, `matchedRules` ada di DB tapi tidak ditampilkan | ✅ Tampil lengkap |
| **Kolom tabel** | Attack Type, Source IP, Severity, Time, Block Button | + Score, Accumulated Score, Decision badge, Matched Rules pills |
| **Rule Chaining** | ❌ Tidak ada breakdown rule yang match | ✅ Pill badge per rule |
| **Threshold Config** | ❌ Tidak ada | ✅ Slider interaktif (fetch + patch `/api/admin/config`) |
| **Active Response Log** | ❌ Tidak ada | ✅ Feed LOG/ALERT/BLOCK dengan reasoning |
| **Sidebar labels** | Dashboard, Detection Panel, Blocked Panel, Get API Key | Monitoring, Detection, Blocked IPs, Alerts, API Key |

---

## Proses Implementasi

### 1. Ubah Tipe Data `ThreatRow` (di DetectionPanel.tsx)

Tambah field baru dari API v2.0:

```typescript
// Sebelum:
interface ThreatRow {
  attackType: string;
  sourceIp: string;
  severity: string;
  latestUpdate: string;
  // ... geo fields
}

// Sesudah (tambah):
interface ThreatRow {
  // ... existing fields ...
  score: number;           // Skor event individual
  accumulatedScore: number;// Skor akumulasi IP
  matchedRules: string[];  // ["SQL Injection", "XSS"]  ← parse dari JSON
  decision: string;        // "LOG" | "ALERT" | "BLOCK"
}
```

### 2. Update API endpoint `/api/detection/threats` GET

Saat ini GET endpoint hanya mengambil 10 log terakhir tanpa field scoring. 

**Yang akan diubah:** Return `score`, `accumulatedScore`, `matchedRules` (di-parse dari JSON string), dan `decision` di setiap record.

```typescript
// Response shape baru:
{
  threats: [
    {
      attackType: "SQL Injection (SQLi) + XSS",
      sourceIp: "192.168.1.1",
      severity: "Critical",
      score: 20,              // ← baru
      accumulatedScore: 24,   // ← baru
      matchedRules: ["SQL Injection (SQLi)", "XSS"], // ← baru, parsed
      decision: "BLOCK",      // ← baru
      latestUpdate: "...",
      // ... geo fields
    }
  ]
}
```

### 3. Overhaul `ThreatTable` Component

**Tabel baru** punya 8 kolom:

| Kolom | Keterangan |
|-------|-----------|
| Attack Type | Nama serangan (sama seperti sekarang) |
| Source IP | IP sumber (sama) |
| Score | Skor event individual → angka dengan color coding (hijau < 7, kuning 7-11, merah ≥ 12) |
| Acc. Score | Skor akumulasi IP → progress bar mini visual |
| Matched Rules | Pill badge kecil per rule yang match |
| Decision | Badge: `LOG` (abu), `ALERT` (kuning), `BLOCK` (merah) |
| Severity | Sama seperti sekarang |
| Action | Tombol block (sama) |

**Dark mode:** Background `#0b1120`, border `slate-700/50`, text `slate-100/300`.

### 4. Komponen Baru: `ScoreBar`

Visual mini progress bar yang menunjukkan `accumulatedScore / blockThreshold`:

```
[████████░░] 8 / 10
```

- Hijau: < alertThreshold
- Kuning: alertThreshold ≤ score < blockThreshold  
- Merah berkedip: ≥ blockThreshold (sudah diblokir)

### 5. Komponen Baru: `ThresholdConfigPanel`

Card di bawah tabel untuk konfigurasi langsung dari UI — fetch dari `/api/admin/config` dan PATCH jika diubah:

```
Block Threshold   [slider: 1─16] = 10
Alert Threshold   [slider: 1─16] = 7
Time Window       [input]        = 5 min
[Save Changes]    [Reset Default]
```

### 6. Komponen Baru: `ActiveResponseFeed`

Feed riwayat keputusan terbaru (max 20 baris):

```
🚫 BLOCK  192.168.1.1   Score: 12/10  SQL Injection + XSS         2 min ago
⚠️ ALERT  10.0.0.5      Score:  8/10  Suspicious Path Probe × 2   5 min ago
📋 LOG    172.16.0.3    Score:  3/10  Empty User-Agent             8 min ago
```

Data diambil dari endpoint yang sama (`/api/detection/threats`), difilter berdasarkan `decision` field.

### 7. Sidebar Rename di Semua Panel

Perubahan berlaku di `DetectionPanel.tsx`, `BlockedPanel.tsx`, `GetApiKey.tsx`, dan `Dashboard.tsx`:

| Key | Label Lama | Label Baru | Icon |
|-----|-----------|-----------|------|
| `dashboard` | Dashboard | Monitoring | `LayoutDashboard` |
| `detection` | Detection Panel | Detection | `Radar` |
| `blocked` | Blocked Panel | Blocked IPs | `ShieldBan` |
| `alerts` | *(tidak ada)* | Alerts | `Bell` ← **item baru** |
| `apikey` | Get API Key | API Key | `KeyRound` |

> **Item Alerts (baru):** Mengarah ke halaman `AlertsPanel` — halaman untuk input Telegram Bot Token, Chat ID, toggle enable, test alert, dan slider threshold.

### 8. Dark Mode — Semua Panel

`DetectionPanel`, `BlockedPanel`, dan `GetApiKey` saat ini masih menggunakan tema **light mode** (sisa migrasi dari Vite). Akan dikonversi ke dark mode yang sama dengan Dashboard:

```
Background:  #070d1a (body) / #0b1120 (card)
Border:      slate-700/50
Text primary: slate-100
Text muted:  slate-400
Accent:      blue-500 / cyan-400
```

---

## File yang Akan Diubah

| File | Jenis Perubahan |
|------|----------------|
| [DetectionPanel.tsx](file:///d:/personal_project/real-mini-siem/siem-dashboard/src/components/DetectionPanel.tsx) | Overhaul besar — dark mode + scoring columns + 3 komponen baru |
| [BlockedPanel.tsx](file:///d:/personal_project/real-mini-siem/siem-dashboard/src/components/BlockedPanel.tsx) | Dark mode + sidebar rename |
| [GetApiKey.tsx](file:///d:/personal_project/real-mini-siem/siem-dashboard/src/components/GetApiKey.tsx) | Dark mode + sidebar rename + tambah item Alerts |
| [Dashboard.tsx](file:///d:/personal_project/real-mini-siem/siem-dashboard/src/components/Dashboard.tsx) | Rename sidebar labels + tambah item Alerts |
| [detection/threats/route.ts](file:///d:/personal_project/real-mini-siem/siem-dashboard/src/app/api/detection/threats/route.ts) | GET endpoint: tambah scoring fields di response |
| **[NEW]** AlertsPanel.tsx | Halaman baru untuk konfigurasi Telegram + threshold |
| **[NEW]** dashboard/page.tsx | Tambah case `alerts` ke switch routing |

---

## Hasil Akhir yang Didapatkan

### Tabel Detection (After)

```
┌─ DETECTION PANEL (Dark Mode) ──────────────────────────────────────────────┐
│                                                                             │
│  Attack Type        IP          Score  Acc.Score  Rules         Decision   │
│  ──────────────────────────────────────────────────────────────────────── │
│  SQL Inj + XSS      185.x.x.x   ██20  ████ 24/10 [SQLi][XSS]  🚫 BLOCK  │
│  Path Probe         42.x.x.x    ▓  4  ██░░  8/10 [PROBE]       ⚠️ ALERT  │
│  Bot Scanner        91.x.x.x    ▒  6  █░░░  3/10 [SCANNER]     📋 LOG    │
│                                                                             │
├─ SCORING CONFIG ────────────────────────────────────────────────────────── │
│  Block ≥ [──────●─] 10    Alert ≥ [────●──] 7    Window [5] min  [Save]  │
│                                                                             │
├─ ACTIVE RESPONSE FEED ─────────────────────────────────────────────────── │
│  🚫 BLOCK  185.x.x.x  Score 24/10  SQL Injection + XSS   2 min ago       │
│  ⚠️ ALERT  42.x.x.x   Score  8/10  Path Probe × 2         5 min ago      │
│  📋 LOG    10.0.0.1   Score  3/10  Empty User-Agent        9 min ago      │
│                                                                             │
├─ LIVE THREAT GLOBE ────────────────────────────────────────────────────── │
│  [Globe 3D interaktif]                                                     │
└─────────────────────────────────────────────────────────────────────────── ┘
```

### Sidebar Baru (All Panels)

```
● Monitoring        ← was: Dashboard
  Detection         ← was: Detection Panel
  Blocked IPs       ← was: Blocked Panel
  Alerts        NEW ← Telegram config + threshold
  API Key           ← was: Get API Key
```

### AlertsPanel (Halaman Baru)

```
┌─ ALERTS & NOTIFICATIONS ──────────────────────────────────────────────────┐
│                                                                            │
│  Telegram Bot Integration                         [Toggle: ON ●]          │
│                                                                            │
│  Bot Token  [••••••••••••••••••••]  [Show/Hide]                          │
│  Chat ID    [-100123456789      ]                                         │
│                                               [Test Alert]               │
│                                                                            │
│  Scoring Thresholds                                                       │
│  Block ≥ [10]   Alert ≥ [7]   Window [5] min    [Save Settings]          │
│                                                                            │
│  Recent Alerts Sent via Telegram                                          │
│  🚫 185.x.x.x blocked — Score 24   SQL Injection   2 min ago            │
│  ⚠️  42.x.x.x alerted  — Score 8   Path Probe      5 min ago            │
└───────────────────────────────────────────────────────────────────────── ┘
```

---

## Open Questions

> [!IMPORTANT]
> 1. **Active Response Feed filter:** Apakah feed hanya menampilkan `ALERT` + `BLOCK`, atau termasuk `LOG`? LOG bisa muncul sangat sering dan membuat tampilan bising. **Rekomendasi:** Default tampilkan ALERT + BLOCK saja, dengan toggle "Tampilkan semua".
> 2. **Tabel 8 kolom:** Pada layar kecil tabel akan horizontal scroll. Apakah ada preferensi kolom mana yang disembunyikan dulu di mobile?
