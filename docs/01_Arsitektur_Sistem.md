# Arsitektur Sistem Mini-SIEM & IPS

Dokumen ini menjelaskan rancangan arsitektur berteknologi hibrida (Hybrid Technology) yang menggabungkan kapabilitas observasi *Log Analysis* secara langsung dengan *Intrusion Prevention System (IPS)* dari CrowdSec.

## 1. Topologi Jaringan

Sistem dibangun dengan menggunakan skenario simulasi penyerangan dari lingkungan sistem operasi eksternal (Host-Only Network VirtualBox).

- **Attacker (Penyerang)**: Kali Linux VM (`192.168.56.101`)
- **Target (Korban)**: Windows OS (`192.168.56.1` / `127.0.0.1`)
- **Web Application Victim**: DVWA berjalan pada XAMPP (Apache + PHP 8 + MySQL)

## 2. Komponen Utama SIEM

Sistem Mini-SIEM terdiri dari 3 blok arsitektur utama:

### A. Data Source (Log Generator)
Modul utama di mana lalu lintas (traffic) sistem dan aplikasi terjadi.
- Menggunakan **Apache Server** (`C:\xampp\apache\logs\access.log`).
- Seluruh Request HTTP terekam lengkap beserta IP, Waktu, Resource path, Status, dan User-Agent.

### B. Detection Engine (Backend Go)
Core backend ditulis menggunakan bahasa Golang, bertugas sebagai otak dari SIEM:
- **Goroutine LogWatcher**: Melakukan *tailing* (pembacaan real-time) terhadap file `access.log` dan menerjemahkannya.
- **Pattern Matching**: Mencocokkan jejak input berbahaya (XSS, SQLi, LFI, Command Injection) dengan *regex signature* terbaik.
- **API Server & WebSocket**: Mengekspos endpoint (`/api/...`) kepada frontend untuk manajemen dan visualisasi (Dashboard).

### C. Intrusion Prevention System (CrowdSec OS Level)
Mini-SIEM ditenagai oleh CrowdSec sebagai agen pemblokiran.
- **CrowdSec LAPI**: Titik integrasi REST API (`http://127.0.0.1:8080`).
- **Windows Firewall Bouncer**: Bergerak di latar belakang memonitor hasil deteksi backend SIEM, dan mengeksekusi aturan *DROP* (blokir mutlak) pada Layer 3/4 di *Windows Defender Firewall*.

---

## 3. Alur Kerja Deteksi (Data Flow Diagram)

1. `Attacker` mengirimkan muatan (payload) berbahaya ke URL DVWA (`GET /DVWA-../?ip=|whoami`).
2. `DVWA/Apache` mencatat request tersebut ke dalam `access.log`.
3. `Mini-SIEM LogWatcher` memindai log seketika dan menemukan kecocokan pola `Command_Injection`.
4. `Mini-SIEM Backend` memanggil `cscli decisions add ...` untuk memerintahkan Firewall mengisolasi IP Penyerang.
5. Secara paralel, `Mini-SIEM Backend` mengirim rekaman insiden ke Database MySQL (`minisiem.security_logs`).
6. `Frontend (Dashboard)` memvisualisasikan data insiden bertatus **BLOCKED** secara otomatis.
