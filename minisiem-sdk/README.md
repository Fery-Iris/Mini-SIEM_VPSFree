# microgaze

> Next.js middleware SDK for **Mini-SIEM** — WAF detection, rate limiting, and automatic threat reporting to your SIEM dashboard.

## Installation

```bash
npm install microgaze
```

> **Requirement:** Next.js 13+ (App Router or Pages Router)

---

## Quick Start

### 1. Buat file `middleware.ts` di root project Next.js kamu:

```ts
// middleware.ts
import { withMiniSIEM } from "microgaze";

export default withMiniSIEM({
  apiKey: process.env.MINISIEM_API_KEY!,
  siemUrl: process.env.MINISIEM_URL!,

  // Opsional — nilai default sudah tersedia
  blockThreshold: 10,   // accumulated score → blokir IP (403)
  alertThreshold: 7,    // accumulated score → alert ke dashboard
  scoreWindowMs: 300000 // 5 menit jendela akumulasi skor
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 2. Set environment variables:

```env
# .env.local
MINISIEM_API_KEY=your_api_key_from_dashboard
MINISIEM_URL=https://your-siem-dashboard.com
```

Dapatkan API Key dari halaman **Settings > API Keys** di Mini-SIEM Dashboard.

---

## Konfigurasi Lengkap

| Parameter | Type | Default | Deskripsi |
|---|---|---|---|
| `apiKey` | `string` | **required** | API Key dari Mini-SIEM Dashboard |
| `siemUrl` | `string` | **required** | Base URL dashboard Mini-SIEM |
| `blockThreshold` | `number` | `10` | Skor akumulasi untuk memblokir IP (return 403) |
| `alertThreshold` | `number` | `7` | Skor akumulasi untuk trigger alert/Telegram |
| `scoreWindowMs` | `number` | `300000` | Jendela waktu akumulasi skor (ms) |

---

## Cara Kerja

```
Request masuk
  → WAF scan (SQL injection, XSS, path traversal, dsb.)
  → Skor diakumulasi per-IP dalam jendela waktu
  → totalScore < alertThreshold  → LOG only
  → totalScore >= alertThreshold → LOG + ALERT (Telegram)
  → totalScore >= blockThreshold → LOG + ALERT + BLOCK (403)
```

---

## Chaining dengan Middleware Lain

```ts
// middleware.ts
import { withMiniSIEM } from "microgaze";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

async function myMiddleware(req: NextRequest) {
  // logika middleware kamu sendiri
  return NextResponse.next();
}

export default withMiniSIEM(
  {
    apiKey: process.env.MINISIEM_API_KEY!,
    siemUrl: process.env.MINISIEM_URL!,
  },
  myMiddleware // ← dijalankan setelah SIEM check lolos
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## Advanced: Akses WAF Rules Langsung

```ts
import { WAF_RULES, detectThreats } from "microgaze";

// Cek ancaman secara manual
const result = detectThreats(url, headers);
console.log(result.detected, result.matches);
```

---

## License

MIT
