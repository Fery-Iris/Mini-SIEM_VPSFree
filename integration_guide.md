# Panduan Integrasi Klien: Domain Premium vs Gratis

Dokumen ini menjelaskan alur kerja lengkap (End-to-End) dari ekosistem Mini-SIEM yang telah kita bangun, serta peran Cloudflare di dalamnya.

## 1. Fungsi API Key Cloudflare
Mengapa kita tetap memasukkan API Key Cloudflare di Dasbor Mini-SIEM jika kita memiliki SDK?

Walaupun Cloudflare versi gratis **menolak memberikan data log** kepada kita, mereka **mengizinkan kita untuk menyuruh mereka melakukan pemblokiran (Push API)**.
Fungsi API Key yang Anda masukkan tadi adalah sebagai **"Senjata Serang Balik" (Active Mitigation)**.

**Alur Serang Balik (Auto-Sync):**
1. Peretas meluncurkan serangan cerdik (misal: menebak-nebak URL sensitif) yang lolos dari WAF otomatis Cloudflare.
2. Trafik lolos dan menabrak **Mini-SIEM SDK** di dalam Next.js klien.
3. SDK kita mengenali serangan itu, langsung memblokir aksesnya (`HTTP 403`), dan diam-diam melapor ke **Dasbor SIEM** Anda.
4. Dasbor SIEM menerima laporan: *"Bos, ada IP `192.168.x.x` menyerang kita!"*.
5. Dasbor SIEM Anda langsung menggunakan **API Key Cloudflare** tersebut untuk menembak API Cloudflare: *"Hai Cloudflare, tolong blokir permanen IP `192.168.x.x` ini dari seluruh jaringanmu."*
6. **Hasil:** Jika si peretas mencoba memuat ulang (*refresh*) halaman sepersekian detik kemudian, dia langsung diblokir di tingkat Edge (Luar Negeri) oleh Cloudflare!

Tanpa API Key, SIEM Anda hanya bisa mengandalkan SDK, yang mana masih memakan *bandwidth* server Vercel Anda saat menolak serangan berulang kali. Dengan API Key, SDK bertindak sebagai Intelijen, dan Cloudflare sebagai Eksekutor globalnya.

---

## 2. Skenario A: Klien dengan Domain Resmi (`.com`, `.my.id`)

Klien kelas menengah-atas ini adalah pengguna yang mendapat perlindungan paling sempurna (Skala *Enterprise*).

- **Prasyarat Integrasi:**
  1. Klien memasang `minisiem-sdk` di Next.js mereka (1 baris Middleware).
  2. Klien mendaftarkan domain mereka ke Cloudflare.
  3. Klien memasukkan API Key Cloudflare mereka ke Dasbor Mini-SIEM Anda.
- **Alur Trafik & Perlindungan:**
  - `Trafik ➡️ Cloudflare Edge (Memblokir DDoS Massal) ➡️ Mini-SIEM SDK (Mendeteksi Serangan Logika Cerdik) ➡️ Server Utama Klien`.
- **Keuntungan Utama:**
  Mereka mendapatkan perlindungan dari dua sisi. SDK menangkap apa yang lolos dari Cloudflare, dan SIEM Anda otomatis mengajari Cloudflare untuk memblokir penyerang tersebut secara permanen.

---

## 3. Skenario B: Klien dengan Domain Gratisan (`.vercel.app`, `.netlify.app`)

Klien pemula ini tidak punya akses ke pengaturan DNS, sehingga tidak mungkin memakai Cloudflare.

- **Prasyarat Integrasi:**
  1. Klien memasang `minisiem-sdk` di Next.js mereka (1 baris Middleware).
  2. Klien HANYA perlu menempelkan `SIEM_API_KEY` dari Dasbor Anda ke dalam proyek mereka. Tidak perlu akun Cloudflare apa pun.
- **Alur Trafik & Perlindungan:**
  - `Trafik ➡️ Vercel Edge ➡️ Mini-SIEM SDK (Pertahanan Tunggal: WAF + Rate Limit) ➡️ Server Utama Klien`.
- **Bagaimana SDK Memblokir Serangan?**
  - Karena tidak ada Cloudflare yang menendang penyerang keluar, SDK harus mengelola *Blacklist* sendiri.
  - Sesuai fitur **Phase 5 (Rate Limiting & Memory Cache)** yang baru kita buat, jika IP tersebut terdeteksi nakal, IP itu akan dicatat ke dalam memori Vercel Edge milik klien.
  - Setiap kali peretas itu mencoba masuk lagi, *Middleware* Vercel akan langsung membenturkan IP tersebut dengan respon `429 Too Many Requests` dalam waktu kurang dari 5 milidetik, tanpa membangunkan *database* utama atau *server logic* klien.
- **Keuntungan Utama:**
  Sistem 100% Gratis, integrasi hanya memakan waktu 1 menit (Copy-Paste SDK), dan aplikasi mereka terlindung penuh dari tebak kata sandi (*Brute-force*) dan serangan injeksi.
