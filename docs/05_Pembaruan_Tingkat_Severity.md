# Pembaruan Tingkat Severity pada Mini-SIEM

Dokumen ini mencatat perubahan yang dilakukan untuk memastikan bahwa semua jenis serangan yang dideteksi oleh sistem Mini-SIEM (seperti SQL Injection, XSS, Brute Force, File Inclusion, dan Command Injection) selalu diklasifikasikan dengan tingkat *severity* (keparahan) **CRITICAL**.

## Latar Belakang
Sebelumnya, sistem memiliki logika yang dinamis untuk menentukan tingkat *severity* suatu ancaman:
- Pada **LogWatcher** (pemantauan log Apache real-time), serangan secara *default* dikategorikan sebagai **High**. Status baru akan naik menjadi **Critical** hanya jika terdapat 3 atau lebih kecocokan pola (pattern) serangan secara bersamaan.
- Pada **CrowdSec Webhook** (penerimaan *alert* via HTTP), tingkat *severity* dipetakan berdasarkan jenis keputusan (Decision Type) atau jumlah *events* yang memicu *alert* tersebut. (Misalnya keputusan *captcha* atau jumlah event di bawah 10 akan dianggap **High** atau **Medium**).

Untuk memenuhi kebutuhan operasional SOC (Security Operations Center) yang mengharuskan respon tegas terhadap ancaman secara langsung, aturan bisnis diubah menjadi: **Semua bentuk penyerangan, tanpa pengecualian, harus langsung memicu status CRITICAL.**

## Perubahan Kode yang Dilakukan

Untuk mengimplementasikan aturan tersebut, dua komponen utama pada `backend` telah dimodifikasi:

### 1. `backend/crowdsec/logwatcher.go`
Pada komponen **LogWatcher**, proses evaluasi dan penentuan tingkat *severity* diubah menjadi statis (langsung memberikan nilai **Critical**).

**Sebelumnya:**
```go
// Determine severity based on pattern count
severity := "High"
if len(bestMatched) >= 3 {
	severity = "Critical"
}
```

**Setelah Diubah:**
```go
// Determine severity
severity := "Critical"
```

### 2. `backend/crowdsec/client.go`
Pada fungsionalitas pemetaan *alert* CrowdSec (khususnya untuk *alert* yang diterima melalui Webhook dan Dashboard), fungsi `MapSeverity()` juga disesuaikan untuk selalu mengembalikan tingkat **Critical** guna menimpa logika dinamis dari CrowdSec.

**Sebelumnya:**
```go
// MapSeverity maps CrowdSec decision type to a severity string for our SIEM.
func MapSeverity(alert Alert) string {
	if len(alert.Decisions) > 0 {
		switch alert.Decisions[0].Type {
		case "ban":
			return "Critical"
		case "captcha":
			return "High"
		case "throttle":
			return "Medium"
		}
	}
	// Fallback based on event count
	if alert.EventsCount >= 10 {
		return "Critical"
	}
	if alert.EventsCount >= 5 {
		return "High"
	}
	return "Medium"
}
```

**Setelah Diubah:**
```go
// MapSeverity maps CrowdSec decision type to a severity string for our SIEM.
func MapSeverity(alert Alert) string {
	// All attacks are considered critical severity
	return "Critical"
}
```

## Dampak Perubahan
1. **Dasbor SOC (Front-end)**: Indikator peringatan pada UI Dasbor (serta pada panel Live Stream) sekarang akan selalu menampilkan warna merah/tag **CRITICAL** secara instan saat serangan terjadi.
2. **Database Logging (`security_logs`)**: Semua *record* ancaman yang dimasukkan ke dalam database kini memiliki kolom `severity` dengan nilai mutlak `Critical`.

---
*Dokumentasi diperbarui pada: 06 Mei 2026*
