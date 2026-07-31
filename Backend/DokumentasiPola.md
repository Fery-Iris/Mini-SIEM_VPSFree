# Dokumentasi Pola Deteksi Serangan — Mini SIEM

Dokumen ini menjelaskan seluruh pola kamus (pattern dictionaries) yang diimplementasikan dalam sistem Mini SIEM untuk mendeteksi 5 jenis serangan keamanan siber.

---

## Arsitektur Deteksi

Mini SIEM menggunakan **Pattern Engine** yang terintegrasi dengan CrowdSec:

```
CrowdSec LAPI / Webhook
        │
        ▼
┌──────────────────────────┐
│   Pattern Engine          │
│   (crowdsec/webhook.go)   │
│                           │
│  1. Terima alert          │
│  2. Identifikasi scenario │
│  3. Mapping ke AttackType │
│  4. Match dgn patterns    │
│  5. Simpan ke DB          │
└──────────────────────────┘
        │
        ▼
   security_logs (MySQL)
```

### Alur Deteksi:

1. **Alert masuk** via webhook (`POST /api/alerts/webhook`) dengan autentikasi API Key
2. **Scenario mapping** — field `scenario` dari CrowdSec dipetakan ke `AttackType` yang sesuai
3. **Pattern matching** — HTTP args dan HTTP path dari event dicocokkan dengan file pola
4. **Pola yang cocok** disimpan sebagai JSON di kolom `payload`
5. **Severity** ditentukan dari tipe keputusan CrowdSec (ban → Critical, captcha → High)

---

## 1. XSS (Cross-Site Scripting)

**File:** `crowdsec/xss_probe_patterns.txt`
**CrowdSec Scenario:** `crowdsecurity/http-xss-probing`
**Action di DB:** `XSS_Attempt`

### Deskripsi

Mendeteksi percobaan injeksi skrip berbahaya ke dalam halaman web melalui input pengguna.

### Kategori Pola

| Kategori | Contoh Pola | Penjelasan |
|----------|-------------|------------|
| Tag HTML berbahaya | `<script`, `<img`, `<svg`, `<embed` | Tag yang bisa mengeksekusi JavaScript |
| Event handler | `javascript:`, `alert(`, `prompt(` | URI dan fungsi JS yang sering dipakai attacker |
| Tag markup | `<input`, `<table`, `<body`, `<meta` | Tag yang bisa disalahgunakan untuk XSS |
| URL-encoded | `%3Cscript`, `%3Csvg`, `javascript%3A` | Varian encoding untuk bypass WAF |

### Cara Deteksi

Engine melakukan **case-insensitive string matching** pada parameter HTTP (`http_args`) terhadap setiap pola. Jika ditemukan substring yang cocok, pola tersebut dicatat dalam `patterns_matched` pada payload.

---

## 2. Brute Force

**File:** `crowdsec/bruteforce_patterns.txt`
**CrowdSec Scenarios:** `crowdsecurity/http-bf-wordpress-bf`, `crowdsecurity/http-generic-bf`, `crowdsecurity/http-bad-user-agent`
**Action di DB:** `Brute_Force`

### Deskripsi

Mendeteksi percobaan login berulang (credential stuffing, password spraying) pada endpoint autentikasi.

### Kategori Pola

| Kategori | Contoh Pola | Penjelasan |
|----------|-------------|------------|
| Path login umum | `/wp-login.php`, `/admin/login`, `/api/auth` | Endpoint yang sering jadi target |
| Username umum | `admin`, `root`, `administrator`, `webmaster` | Username default yang dicoba attacker |
| Password lemah | `password`, `123456`, `admin123`, `letmein` | Password yang sering dicoba |
| Header spoofing | `X-Forwarded-For`, `X-Real-IP` | Header untuk menyembunyikan IP asli |
| URL-encoded | `%2Fwp-login`, `%2Fadmin` | Varian encoding |

### Cara Deteksi

Selain pattern matching, CrowdSec sendiri mendeteksi brute force berdasarkan **frekuensi percobaan gagal** dalam jangka waktu tertentu. Mini SIEM menerima alert ini dan mencocokkan detail event dengan pola kamus untuk memperkaya data.

---

## 3. File Inclusion (LFI/RFI)

**File:** `crowdsec/file_inclusion_patterns.txt`
**CrowdSec Scenarios:** `crowdsecurity/http-path-traversal-probing`, `crowdsecurity/http-open-proxy`
**Action di DB:** `File_Inclusion`

### Deskripsi

Mendeteksi percobaan Local File Inclusion (LFI) dan Remote File Inclusion (RFI) yang bertujuan membaca file sensitif atau mengeksekusi kode remote.

### Kategori Pola

| Kategori | Contoh Pola | Penjelasan |
|----------|-------------|------------|
| Path traversal | `../`, `..%2F`, `%2e%2e%2f` | Naik ke direktori induk |
| File sensitif Linux | `/etc/passwd`, `/etc/shadow`, `/proc/self/environ` | File konfigurasi dan sistem |
| File sensitif Windows | `\windows\win.ini`, `boot.ini` | File sistem Windows |
| PHP Wrapper (RFI) | `php://filter`, `php://input`, `data://`, `expect://` | Stream wrapper PHP untuk RFI |
| Remote inclusion | `http://`, `ftp://`, `\\\\` | Indikator inklusi file remote |
| Null byte | `%00`, `%2500` | Bypass ekstensi file |

### Cara Deteksi

Pattern matching dilakukan pada **HTTP path DAN HTTP args** — karena serangan file inclusion sering muncul di URL path (misalnya `/page?file=../../etc/passwd`).

---

## 4. Command Injection

**File:** `crowdsec/command_injection_patterns.txt`
**CrowdSec Scenarios:** `crowdsecurity/http-generic-exploit`, `crowdsecurity/http-cve-probing`
**Action di DB:** `Command_Injection`

### Deskripsi

Mendeteksi percobaan eksekusi perintah sistem operasi melalui input HTTP yang tidak tersanitasi.

### Kategori Pola

| Kategori | Contoh Pola | Penjelasan |
|----------|-------------|------------|
| Shell operator | `;`, `\|`, `&&`, `` ` ``, `$(` | Karakter chaining perintah |
| Perintah Unix | `whoami`, `cat /etc`, `ls -la`, `wget`, `curl` | Perintah umum untuk reconnaissance |
| Perintah Windows | `cmd /c`, `powershell`, `net user`, `systeminfo` | Perintah Windows yang sering dieksploitasi |
| Encoding | `%0a`, `%3B`, `%7C`, `%60` | Varian URL-encoded |
| Reverse shell | `/dev/tcp`, `nc -e`, `bash -i >& /dev/tcp` | Indikator pembukaan koneksi balik |

### Cara Deteksi

Matching dilakukan pada HTTP args dan HTTP path. Karena command injection sangat bergantung pada karakter khusus (`;`, `|`, `` ` ``), engine mencocokkan **substring** — bahkan karakter tunggal bisa menjadi indikator saat dikombinasikan dengan konteks scenario CrowdSec.

---

## 5. SQL Injection

**File:** `crowdsec/sql_injection_patterns.txt`
**CrowdSec Scenario:** `crowdsecurity/http-sqli-probing`
**Action di DB:** `SQL_Injection`

### Deskripsi

Mendeteksi percobaan injeksi query SQL berbahaya ke dalam input aplikasi untuk mengakses atau memanipulasi database.

### Kategori Pola

| Kategori | Contoh Pola | Penjelasan |
|----------|-------------|------------|
| Classic SQLi | `' OR '1'='1`, `' OR 1=1--`, `admin'--` | Bypass autentikasi |
| Union-based | `UNION SELECT`, `UNION ALL SELECT`, `ORDER BY 1--` | Ekstraksi data dari tabel lain |
| Error-based | `extractvalue(`, `updatexml(`, `CONVERT(int,@@version)` | Memaksa error untuk mengungkap info |
| Time-based blind | `SLEEP(`, `BENCHMARK(`, `WAITFOR DELAY`, `pg_sleep(` | Deteksi SQL injection secara buta |
| Stacked queries | `; DROP TABLE`, `; DELETE FROM`, `xp_cmdshell` | Eksekusi query destruktif |
| Info gathering | `@@version`, `information_schema`, `LOAD_FILE(` | Mengumpulkan informasi database |
| Komentar SQL | `--`, `#`, `/**/`, `%23` | Menutup query asli |
| URL-encoded | `%27%20OR`, `%27%3B`, `UNION%20SELECT` | Varian encoding untuk bypass filter |
| Hex-encoded | `0x27`, `CHAR(39)`, `CHR(39)` | Varian hex untuk bypass |

### Cara Deteksi

Engine mencocokkan input HTTP args terhadap pola-pola di atas. SQL Injection sering mengandung kata kunci SQL (SELECT, UNION, DROP) yang dikombinasikan dengan karakter khusus (`'`, `--`, `#`), sehingga matching dilakukan secara case-insensitive.

---

## Ringkasan

| # | Jenis Serangan | File Pola | Jumlah Pola | CrowdSec Scenario |
|---|----------------|-----------|-------------|-------------------|
| 1 | XSS | `xss_probe_patterns.txt` | 36 | `http-xss-probing` |
| 2 | Brute Force | `bruteforce_patterns.txt` | 40 | `http-bf-wordpress-bf`, `http-generic-bf`, `http-bad-user-agent` |
| 3 | File Inclusion | `file_inclusion_patterns.txt` | 48 | `http-path-traversal-probing`, `http-open-proxy` |
| 4 | Command Injection | `command_injection_patterns.txt` | 57 | `http-generic-exploit`, `http-cve-probing` |
| 5 | SQL Injection | `sql_injection_patterns.txt` | 65 | `http-sqli-probing` |

## Cara Menambah Pola Baru

1. Edit file `crowdsec/<nama>_patterns.txt` yang sesuai
2. Tambahkan pola baru (satu per baris), baris yang diawali `#` adalah komentar
3. Restart server — pola dimuat otomatis saat `init()`
4. Tidak perlu mengubah kode Go sama sekali
