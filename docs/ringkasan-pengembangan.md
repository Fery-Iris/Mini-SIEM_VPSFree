# Ringkasan Pengembangan (Development Summary)

## Phase 3: Detection Overhaul & Sidebar Refactoring

Dokumen ini merangkum seluruh perubahan dan bug fixes yang telah diselesaikan pada sesi ini:

### 1. Refactoring Struktur Routing (Flat URLs)
- Mengubah struktur routing dari nested `/dashboard/*` menjadi rute flat level atas (`/detection`, `/blocked`, `/alerts`, `/apikey`).
- Menerapkan **Next.js Route Group** `(protected)` untuk membungkus semua halaman tersebut dengan layout yang sama.
- Keuntungan: Sidebar navigasi dan state (seperti drawer) menjadi persisten tanpa re-render penuh antar halaman.

### 2. Perbaikan Fitur Generate API Key (Error 500)
- **Akar Masalah**:
  1. Skema Prisma (tabel `ApiKey`) sudah ditambahkan tapi client Prisma belum di-regenerate, sehingga client tidak tahu ada tabel `ApiKey`.
  2. Data dummy login (`admin@xrsecurity.com`) di-hardcode menggunakan string ID `"mock-id-123"` dalam JWT. Ketika query Prisma yang membutuhkan tipe integer dipanggil (misal `adminId`), terjadi crash/error 500 karena tipe datanya string.
- **Solusi**:
  1. Menjalankan `npx prisma db push` dan `npx prisma generate` untuk memperbarui database dan schema client.
  2. Mengubah endpoint login untuk melakukan `upsert` akun dummy langsung ke database PostgreSQL sehingga menghasilkan integer ID valid untuk dimasukkan ke payload JWT.
  3. Memperbaiki pemetaan tipe kembalian data (`data.key`) pada komponen UI `GetApiKey.tsx`.

### 3. Implementasi Database Seeding
- Membuat file `prisma/seed.ts` (menggunakan TypeScript & library `tsx`) untuk mempermudah inisialisasi data.
- Menghasilkan 1 akun admin demo, 1 konfigurasi AdminConfig, dan 10 riwayat log ancaman (SecurityLogs) dummy (seolah terjadi dalam 24 jam terakhir).
- Menambahkan perintah `npm run seed` ke `package.json`.

### 4. Perbaikan Visualisasi Globe & Error Three.js
- **Akar Masalah**: Muncul pesan error di console: `THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN`. Ini dikarenakan kita mengoper string literal `"SOC_CENTER.lat"` sebagai props ke komponen `react-globe.gl` (`arcEndLat`). Karena string literal tidak bisa diparsing sebagai angka, proses rendering geometri busur di Three.js menghasilkan koordinat `NaN`.
- **Solusi**: Memperbaiki nama pengoperan string untuk properti tersebut di `DetectionPanel.tsx` menjadi properti valid `"endLat"` dan `"endLng"` yang merujuk pada objek target.

### 5. SDK Middleware (v2.0)
- Menggunakan arsitektur Wazuh-inspired (Skor kumulatif dari 0 - 16). 
- Penambahan fungsi akumulasi skor per IP dalam jendela waktu tertentu, dimana sistem akan otomatis memberikan *Decision* (`LOG`, `ALERT`, atau `BLOCK`) berdasarkan skor akumulatif.

Seluruh dokumentasi implementasi teknis lengkapnya telah disimpan di `docs/implementasi.md`.
