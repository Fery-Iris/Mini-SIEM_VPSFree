# Dokumentasi LogWatcher Engine (Hybrid Detection)

Dokumen ini mendeskripsikan otak di balik deteksi serangan di Mini-SIEM, yaitu komponen `LogWatcher`. Komponen ini dikembangkan secara custom menggunakan bahasa Golang.

## Kenapa Menggunakan LogWatcher Custom?
Implementasi murni menggunakan *CrowdSec Engine* di sistem operasi Windows memiliki beberapa batasan kritis terkait *Active Directory SID lookup* di mana engine seringkali *crash* atau *hang* saat melakukan parsing log kompleks.
Sebagai solusinya, **Hybrid Detection** diterapkan. Mini-SIEM meminjam *Threat Intelligence Patterns* milik CrowdSec dan membangun detektornya sendiri.

## Mekanisme Pengecekan Akses (Tailing)

- Logwatcher menggunakan teknik *stream reading* secara asinkronus (goroutines) terhadap file `C:\xampp\apache\logs\access.log`.
- Format Log yang di-parsing adalah Apache Combined Log Format regex:
  `^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) (\S+) HTTP/\d\.\d" (\d{3}) \d+ "([^"]*)" "([^"]*)"`

## Algoritma Best-Match (Menghindari False Positives)

Sistem menggunakan metode **Best-Match** dalam membaca indikasi serangan:
1. URL yang dikirim pengunjung (contoh `?id=1' OR '1'='1`) akan dievaluasi melawan **RATUSAN** file pola regex (CI, SQLi, XSS, FI).
2. Sistem TIDAK berhenti pada kecocokan pertama. Ia akan mengevaluasi *seluruh* jenis serangan.
3. Serangan yang memiliki **skor kecocokan terbanyak** (most match count) akan dinobatkan sebagai label serangan final.
4. **Proteksi Karakter Pendek:** Fungsi `identifyPatternsMinLen` memastikan bahwa pola yang panjangnya di bawah 3 karakter (seperti `;`, `|`, `id`) **sepenuhnya diabaikan** untuk mencegah deteksi palsu (false-positive).

## Restriksi Khusus Brute Force (Rate Limiting)
Mini-SIEM menggunakan **Sliding Window Rate Limiter** untuk mendeteksi serangan Brute Force secara akurat:

1. **Tahap 1 — Deteksi User-Agent:** Pola kamus `bruteforce_patterns.txt` dicocokkan terhadap User-Agent. Jika cocok (misal tool `Hydra`, `sqlmap`), langsung ditandai sebagai serangan **tanpa perlu rate limiting**.
2. **Tahap 2 — Rate Limiting Login Path:** Jika User-Agent normal (browser biasa), sistem memantau frekuensi akses ke path sensitif (`/wp-login`, `/admin/login`, `/login.php`, `/signin`, dll). Brute Force **hanya** ter-trigger jika IP yang sama mengakses login path **≥ 5 kali dalam 30 detik** (konfigurasi via env `BF_THRESHOLD` dan `BF_WINDOW_SEC`).
3. Akses normal ke halaman login (1-3 kali) **TIDAK** akan memicu deteksi, sehingga admin aman dari false-positive.

> Lihat dokumentasi lengkap: [06_Brute_Force_Rate_Limiting.md](./06_Brute_Force_Rate_Limiting.md)

## Intervensi Langsung (Native Push)
Saat skor serangan menembus batasan:
1. Pendaftaran Log ke Database untuk pelaporan ke Admin.
2. Pemanggilan fungsi Sub-Proses sistem operasi (OS/EXEC):
   `cscli decisions add -i <IP_Address> -d 4h`
3. Menstimulasi Bouncer untuk memblokir pertukaran paket data OS (Windows Firewall).
