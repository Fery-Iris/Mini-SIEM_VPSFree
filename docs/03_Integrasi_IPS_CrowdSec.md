# Dokumentasi Integrasi IPS CrowdSec (Windows Bouncer)

Dokumen ini membedah bagaimana Intrusion Prevention System digabungkan secara utuh dengan sistem operasi Windows menggunakan _CrowdSec Windows Firewall Bouncer_.

## Instalasi Peran dan Posisi LAPI

Dalam arsitektur konvensional, CrowdSec Engine melacak log dan memutuskan status Blokir secara tertutup.
Dalam Mini-SIEM, posisi ini **dipisah (decoupled)**:

- Algoritma pemecah (Parser) ditangani oleh LogWatcher Go.
- Posisi pemicu Blokir dikembalikan lagi kepada **CrowdSec LAPI** agar dieksekusi secara standar keamanan tinggi.

## Mengatasi Isu Network Hijacking (Localhost vs 127.0.0.1)

Selama pengujian performa Bouncer, terdapat kendala _Request Timeout (100 seconds)_ di mana pelaporan blokir Bouncer dan Mini-SIEM tidak berfungsi.

- **Insiden:** Windows secara _default_ menerjemahkan alias pemanggilan konfigurasi Bouncer `http://localhost:8080` menjadi protokol IPv6 (`[::1]:8080`).
- **Masalah:** Alamat IPv6 tersebut (secara tidak disengaja) dirampas pendengarannya oleh servis Windows lain di luar Crowdsec (seperti `AgentService.exe` dari Antivirus/Driver Eksternal).
- **Resolusi Final:** Modifikasi target koneksi di `C:\ProgramData\CrowdSec\config\bouncers\cs-windows-firewall-bouncer.yaml` diatur keras (Hardcoded) ke alamat khusus IPv4 `http://127.0.0.1:8080` sehingga mengunci pengiriman request LAPI hanya untuk layanan CrowdSec sejati yang mendengarkan pada target port tersebut.

## Logika Modul Pencabutan (Unblock / Pemutihan IP)

Selain memblokir, integrasi Bouncer harus memperbolehkan _Administrator_ merevisi kesalahpahaman sistem (_False Positives_). Modul Unblock berada di dalam fungsi `HandleUnblockIP` (Go Backend).

Ketika menekan "Unblock IP" dari layar Mini-SIEM:

1. Menghapus status `is_blocked = 1` pada database MySQL `minisiem`.
2. Secara diam-diam mengeksekusi sub-proses OS dengan previlese tertinggi:
   `cscli decisions delete -i <TARGET_IP>`
3. Seketika membersihkan aturan pemblokiran IP Drops dari Registry/Manajer Firewall lokal Windows Defender.
