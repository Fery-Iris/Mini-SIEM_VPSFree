# Skenario Pengujian Tugas Akhir (Test Plan)

Bagian ini menyajikan tahapan demonstrasi berurutan yang dapat direplikasi di hadapan dosen penguji untuk membuktikan kapabilitas *Intrusion Prevention System (IPS)* di Mini-SIEM berfungsi secara *Fault-Proof* dan 100% responsif.

## Pra-Pekerjaan Pengujian (Setup Demo)

1. DVWA Website & Database MySQL (XAMPP) dalam status berjalan/Start.
2. Servis `CrowdSec Windows Firewall Bouncer` berjalan normal.
3. Jalankan Terminal Admin `go run .` pada root proyek backend Mini-SIEM.
4. Buka Web Dashboard Mini-SIEM, pastikan tabel `Blocked Panel` kosong (Klik Unblock bila masih ada data tersisa IP Kali Linux).

## Skenario 1: Visualisasi Log Secara Transparan

* **Tindakan**: Buka Web DVWA dari browser OS penyerang (Kali Linux: `192.168.56.101`). Lakukan klik biasa, contoh mengunjungi halaman Help (Aktivitas Normatif).
* **Hasil Diharapkan**: Dashboard tak menunjukkan tanda Bahaya (warna Normal/Info), aktivitas IP Kali terekam murni sebagai trafik web biasa di halaman *Detection Panel*.

## Skenario 2: Serangan Pertama (Injeksi) & Eksekusi Perintah

* **Tindakan**: Buka `Burp Suite` di Kali Linux, rekayasa permintaan menjadi metode **GET**. Masukkan Payload Command Injection `?ip=127.0.0.1%7Cwhoami` dan tekan klik.
* **Hasil Diharapkan**:
  1. *Server* meladeni serangan tersebut; pada response tab Burp, `whoami` membalas dengan cetakan string nama pengguna sistem ("`mybookhype\...`"). Ini pertanda DVWA memiliki bolong kerentanan asli.
  2. Mini-SIEM bereaksi berkat `LogWatcher`. Indikator status melesat menjadi **CRITICAL / HIGH**, terdeteksi: `Command_Injection` dari IP `192.168.56.101`! Tab Dashboard menguning kencang dan IP tersebut dicatat tebal-tebal dengan kata "**BLOCKED**".

## Skenario 3: Isolasi Dinding Api (Validasi Isolasi IPS)

* **Tindakan**: Tekan tombol "Send" untuk kedua kalinya di aplikasi `Burp Suite` (atau cukup *refresh* Web Browser DVWA Kali Linux 2 kali).
* **Hasil Diharapkan**: Aplikasi *Macet* (Hanging/Timeout). Mesin DVWA pada Windows seolah *menghilang ditelan bumi*. Windows Firewall (yang dikendalikan oleh *CrowdSec Bouncer*) menendang telak semua paket Request TCP/HTTP dari dan menuju port-port OS Windows Anda untuk si IP mesin Kali. Pembuktian penuh bahwa IPS 100% menjaga eksklusi dari serangan lanjutan.

## Skenario 4: Re-habilitasi IP (Unblock & Reset)

* **Tindakan**: Pergi ke `Dashboard Mini-SIEM`, layarkan kursor ke `Blocked Panel`.
* **Aksi**: Temukan data IP *`192.168.56.101`* Kali Anda. Tekan/Klik Tombol "Unblock" berwarna biru.
* **Hasil Diharapkan**: Backend melempar sinyal `cscli decisions delete...` yang sekejap melunturkan ban tersebut pada Windows Defender Firewall.
* **Uji Langsung Cek-Balik**: Kini ketika Anda meng-*refresh* DVWA di komputer Kali, web kembali terbuka luas, membuktikan bahwa Mini-SIEM juga merupakan alat manajemen tembok api secara Remote (API-driven).
