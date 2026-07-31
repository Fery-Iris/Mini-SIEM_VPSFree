# Mini-SIEM Migration Context & Architecture

## 1. Latar Belakang Migrasi
Mini-SIEM sebelumnya menggunakan arsitektur monolitik tradisional (Golang Backend + Vite/React Frontend + MySQL) yang mewajibkan pengguna (developer dan klien) untuk memiliki VPS (Virtual Private Server). 
Karena klien sering kali hanya bermodalkan *hosting* gratis seperti Vercel atau Netlify, arsitektur ini dirombak menjadi **Serverless Architecture** menggunakan **Next.js App Router** dan **PostgreSQL (Prisma Accelerate/Supabase)**.

## 2. Perubahan Arsitektur
- **Backend Lama (Golang):** Ditinggalkan. Seluruh logika (Login, Register, Dashboard, Detection, IP Blocking) telah dipindahkan ke **Next.js API Routes** (`src/app/api/...`).
- **Frontend Lama (Vite):** Ditinggalkan. Semua komponen antarmuka dipindahkan ke dalam struktur Next.js (`src/components/` dan `src/app/`).
- **Database Lama (MySQL):** Ditinggalkan. Digantikan oleh **PostgreSQL** yang diakses menggunakan ORM **Prisma**.
- **Metode Integrasi Klien (WAF/IPS):** Sebelumnya klien perlu men- *deploy* sistem di VPS mereka (atau Reverse Proxy Cloudflare). Kini, klien hanya perlu menginstal NPM Package / Middleware (Mini-SIEM SDK) di aplikasi Next.js mereka dengan model "3-baris copy-paste".

## 3. Struktur Proyek Saat Ini (`siem-dashboard/`)
Semua kode terbaru berada di dalam folder `siem-dashboard` (proyek Next.js):
- `src/lib/prisma.ts`: Singleton koneksi Prisma ke PostgreSQL.
- `src/app/api/auth/`: Endpoint untuk *Login* dan *Register* (JWT & Bcrypt).
- `src/app/api/dashboard/`: Endpoint untuk metrik Dasbor (Stats & Logs).
- `src/app/api/detection/` & `src/app/api/blocked/`: Endpoint interaksi dengan agen keamanan / Middleware SDK.
- `prisma/schema.prisma`: Skema database yang mendefinisikan tabel `Organization`, `Admin`, `SecurityLog`, dan `ApiKey`.

## 4. Status Saat Ini (Fase Migrasi)
- ✅ **Phase 1 (Setup & Backend):** Selesai. Database berhasil disinkronisasi, dan seluruh API inti Golang telah diterjemahkan ke *Serverless Route Handlers* di Next.js.
- ⏳ **Phase 2 (Client SDK):** (Sedang/Akan Berjalan). Membangun *Middleware Next.js SDK* (`minisiem-nextjs-sdk`) agar klien dapat menangkis ancaman (OWASP Top 10, Bot, DDoS) secara fungsional tanpa memerlukan VPS.
- ⏳ **Phase 3 (Frontend Refactoring):** Menyempurnakan UI Next.js agar *dashboard* admin berjalan mulus dengan API Routes yang baru dibuat.

## 5. Aturan Penting (Ground Rules)
1. Proyek ini harus bisa di-*deploy* sepenuhnya di *platform* Serverless (seperti Vercel).
2. Dilarang menggunakan teknologi yang membutuhkan VPS / proses *background daemon* permanen bagi sisi *Client*.
3. Fokus pada kemudahan pengguna (DX/UX) yang ramah untuk pemula (*Copy-Paste Integration*).


Ini adalah pertanyaan yang sangat praktis! Jika klien Anda menggunakan subdomain gratisan bawaan platform (seperti tokolily.netlify.app atau tokolily.vercel.app), ada satu fitur yang tidak bisa digunakan, tetapi sisa sistem Mini SIEM Anda tetap bisa berjalan.

Mari kita bahas detailnya:

Yang TIDAK BISA digunakan: Cloudflare WAF (Lapis Pertama)
Klien dengan domain *.netlify.app atau *.vercel.app tidak bisa menggunakan Cloudflare. Alasannya: Cloudflare mewajibkan Anda memiliki akses ke Domain Registrar (tempat beli domain) untuk mengubah Name Server (NS). Karena klien tidak memiliki kepemilikan atas domain induk netlify.app, mereka tidak bisa merutekan traffic melalui Cloudflare.

Oleh karena itu, perlindungan IPS instan dan anti-DDoS dari Cloudflare tidak bisa diterapkan untuk klien ini.

Yang TETAP BISA digunakan: Application-level IDS/IPS (Lapis Kedua)
Walaupun tanpa Cloudflare, klien tokolily.netlify.app tetap bisa terintegrasi dengan minisiem.my.id milik Anda. Caranya adalah dengan memindahkan beban keamanan (IPS/IDS) murni ke dalam kode aplikasi mereka (Application-Level).

Berikut adalah cara kerjanya jika menggunakan Next.js:

1. IPS (Pencegahan & Pemblokiran) dipindah ke Next.js Middleware Karena tidak ada Cloudflare, Klien harus memasang script Middleware ringan di proyek Next.js mereka. Middleware ini terhubung ke database terpusat (misalnya Upstash Redis) milik minisiem.my.id.

Setiap kali ada visitor masuk ke tokolily.netlify.app, Middleware klien akan mengecek IP tersebut ke Redis Mini SIEM Anda (memakan waktu hanya ~10-20 milidetik).
Jika IP tersebut masuk blacklist (daftar blokir), Middleware langsung merespon HTTP 403 Forbidden. Aplikasi React/Next.js di baliknya tidak akan terbebani.
2. SIEM (Pengumpulan Log) Tetap Berjalan via API Aplikasi tokolily.netlify.app tetap bisa mengirimkan log request (seperti IP pengunjung, URL yang diakses, status code) ke endpoint API Anda di minisiem.my.id secara asinkron (background task), atau menembaknya langsung ke layanan cloud seperti Axiom.

3. Action "Block IP" dari Dashboard Anda Skenario saat Anda (atau Klien) menekan tombol "Block IP" di dashboard minisiem.my.id:

IP penyerang dimasukkan ke dalam database Redis terpusat milik Anda.
Detik berikutnya, ketika penyerang mencoba mengakses tokolily.netlify.app, Middleware di aplikasi tersebut akan melihat bahwa IP tersebut sudah ada di database Redis (Blacklist), dan langsung memblokirnya.
Kesimpulan
Bisa dibilang, Anda membuat sistem "Mini SIEM as a Service". Klien bermodal domain gratisan tetap bisa menggunakan layanan Anda, asalkan mereka menambahkan SDK/Middleware Mini SIEM Anda ke dalam source code Next.js mereka.

Jadi, Cloudflare digunakan sebagai nilai tambah (jika klien punya domain khusus/premium), tetapi core engine Mini SIEM Anda tetap bertumpu pada Next.js Middleware dan Redis. Apakah alur integrasi via Middleware ini masuk akal untuk model bisnis Anda?

1. Klien dengan Domain Berbayar (.com, .my.id)
Integrasi: 100% Tanpa Buka Kode (Zero Code). Klien hanya perlu login ke tempat mereka beli domain (misal Niagahoster/Idwebhost), lalu mengubah Name Server (NS) ke Cloudflare Anda. Selesai. Aplikasi Next.js mereka tidak perlu disentuh sama sekali.

2. Klien dengan Domain Gratisan (*.netlify.app)
Integrasi: Low-Code (Sentuh sedikit kode, tapi sangat mudah). Karena tidak bisa via DNS, klien harus memasukkan "Satpam Mini SIEM" ke aplikasi Next.js mereka. Sebagai penyedia layanan, Anda bisa mengakalinya dengan membuat NPM Package.

Klien hanya perlu melakukan 2 langkah sederhana (mirip seperti memasang Google Analytics):

Langkah 1: Install package Mini SIEM buatan Anda di terminal mereka:

bash
npm install minisiem-nextjs-sdk
Langkah 2: Klien membuat satu file bernama middleware.ts (jika belum punya) dan menempelkan (copy-paste) 3 baris kode yang Anda sediakan:

typescript
import { MiniSiemMiddleware } from 'minisiem-nextjs-sdk';
// Masukkan API Key yang didapat dari Dashboard minisiem.my.id
export default MiniSiemMiddleware({ apiKey: "SIEM_XYZ123..." });
export const config = {
  matcher: '/:path*', // Terapkan keamanan ke semua halaman
};
Selesai! Klien tidak perlu tahu cara kerja rate-limiting, Redis, atau pengiriman log. Semuanya sudah dibungkus rapi di dalam minisiem-nextjs-sdk buatan Anda.

Kesimpulan
Untuk klien free domain, kita wajib masuk ke dalam kodenya, tapi kita bisa mendesainnya agar terasa seperti copy-paste satu baris kode saja. Ini adalah standar yang umum digunakan oleh layanan SaaS besar seperti Clerk, Sentry, atau PostHog ketika berintegrasi dengan Next.js.