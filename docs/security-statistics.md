# Security Statistics Calculation

Dokumentasi ini menjelaskan bagaimana sistem menghitung persentase perubahan harian (kenaikan/penurunan) untuk metrik keamanan di dashboard.

## 1. Cara Kerja Perhitungan
Dashboard keamanan menampilkan tiga metrik utama:
- **Attacks Blocked**: Serangan yang berhasil diblokir.
- **Total Threats**: Total ancaman dengan tingkat keparahan tinggi (Critical).
- **Active Sources**: Jumlah alamat IP unik (sumber aktif).

Untuk setiap metrik, sistem akan mengambil tiga nilai dari database:
- `Total`: Jumlah seluruh event dari awal waktu.
- `Today`: Jumlah event hari ini.
- `Yesterday`: Jumlah event hari kemarin.

Perhitungan persentase perubahan didasarkan pada perbandingan antara nilai `Today` dan `Yesterday`.

## 2. Rumus yang Digunakan
Sistem menggunakan rumus matematika sederhana untuk persentase perubahan:
```text
percentage_change = ((today_count - yesterday_count) / yesterday_count) * 100
```
Hasil perhitungan ini kemudian dibulatkan menjadi maksimal 1 digit desimal jika diperlukan (contoh: 5.4%). Jika bernilai bulat, akan ditampilkan tanpa desimal.

## 3. Edge Cases Handling
Beberapa kasus khusus ditangani secara hati-hati melalui file `backend/helpers/statistics.go` untuk menghindari error sistem:
- **Yesterday = 0 dan Today > 0**: Menghasilkan nilai `+100%`.
- **Yesterday = 0 dan Today = 0**: Menghasilkan nilai `0%`.
- **Division by Zero**: Sistem memeriksa kondisi `Yesterday == 0` sebelum melakukan pembagian, sehingga tidak akan memicu *division by zero error*.

## 4. Contoh Perhitungan
- **Kenaikan (Positif)**:
  - Kemarin = 50 ancaman, Hari ini = 75 ancaman.
  - Perhitungan: `((75 - 50) / 50) * 100 = 50%` (Tampil sebagai `+50%` dengan warna hijau).
- **Penurunan (Negatif)**:
  - Kemarin = 100 ancaman, Hari ini = 80 ancaman.
  - Perhitungan: `((80 - 100) / 100) * 100 = -20%` (Tampil sebagai `-20%` dengan warna merah).
- **Sama (Netral)**:
  - Kemarin = 0 ancaman, Hari ini = 0 ancaman.
  - Perhitungan: Tidak dihitung secara matematis karena kemarin 0, ditangani oleh pengecekan khusus menjadi `0%` (Tampil dengan warna abu-abu).

## 5. Struktur Query
Pengambilan data metrik dioptimalkan menjadi hanya 1 query SQL per metrik (terdapat dalam fungsi `getCounts` di `backend/handlers/dashboard.go`).
Contoh query untuk mengambil data Total, Today, dan Yesterday secara bersamaan:

```sql
SELECT 
    COUNT(*),
    COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 1 ELSE 0 END), 0)
FROM security_logs 
WHERE is_blocked = 1;
```

**Penjelasan Query:**
- Menggunakan parameter kondisional (`is_blocked = 1`, `severity = 'Critical'`).
- Jika terdapat parameter multitenant (`admin_id`), kondisi tersebut ikut disertakan di `WHERE` clause.
- Menggunakan `SUM` dan pengondisian `DATE()` untuk menghitung total hari ini dan total hari kemarin.
- Menghindari query berganda yang tidak perlu (efisiensi akses ke tabel `security_logs`).
- Khusus metrik **Active Sources** (pengguna unik), perhitungan menggunakan `COUNT(DISTINCT ip_address)` diiringi dengan kondisi `CASE WHEN`.

## 6. Contoh Response JSON
Berikut adalah struktur JSON respons API untuk `/api/dashboard/stats`:

```json
{
  "stats": [
    {
      "label": "Attacks Blocked",
      "value": "1250",
      "change": "+25%",
      "sub": "Last 24 Hours",
      "icon": "ShieldAlert",
      "iconBg": "bg-red-50",
      "iconColor": "text-red-400",
      "changeBg": "text-emerald-500"
    },
    {
      "label": "Total Threats",
      "value": "42",
      "change": "-10.5%",
      "sub": "Active Incidents",
      "icon": "AlertTriangle",
      "iconBg": "bg-amber-50",
      "iconColor": "text-amber-400",
      "changeBg": "text-red-500"
    },
    {
      "label": "Active Sources",
      "value": "180",
      "change": "0%",
      "sub": "Unique IP Addresses",
      "icon": "Users",
      "iconBg": "bg-cyan-50",
      "iconColor": "text-cyan-500",
      "changeBg": "text-slate-400"
    }
  ],
  "totalEvents": 3500
}
```
*Frontend akan langsung menampilkan indikator warna dan nilai berdasarkan properti `change` dan `changeBg`*.

## 7. Cara Extend (Mingguan/Bulanan)
Jika ingin mendukung periode waktu selain Harian (misalnya Mingguan atau Bulanan), perubahan dapat dilakukan dengan:
1. **Frontend**: Tambahkan dropdown untuk filter rentang waktu (misalnya "Hari Ini", "Minggu Ini", "Bulan Ini") yang mengirim parameter query ke backend, misal `?range=weekly`.
2. **Backend `dashboard.go`**: Ubah fungsi `getCounts` untuk mendeteksi `range`.
   - Untuk Mingguan (`weekly`): Ganti `CURDATE()` dengan kondisi yang mencakup `YEARWEEK(created_at) = YEARWEEK(CURDATE())` dan periode sebelumnya.
   - Untuk Bulanan (`monthly`): Ganti dengan fungsi pencocokan bulan seperti `MONTH(created_at) = MONTH(CURDATE())` dan periode bulan lalu menggunakan `DATE_SUB`.
3. **Persentase**: Logika di helper `CalculatePercentageChange` bisa tetap digunakan secara umum, dengan hanya menyalurkan nilai agregasi `currentPeriodCount` dan `previousPeriodCount`.
