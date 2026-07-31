# Dokumentasi Perbaikan: Sinkronisasi Status IP Management

**Tanggal:** 18 April 2026  
**Judul:** Perbaikan Logika Sinkronisasi Status IP pada Sistem Block/Unblock dan Detection Panel

---

## Deskripsi Masalah

Ditemukan **dua masalah logika kritis** pada sistem manajemen IP mini-SIEM:

### Masalah 1 — Alur Unblocking Tidak Lengkap
Saat IP dihapus dari *Blocked Panel*, IP tersebut menghilang dari daftar blokir namun **gagal dipindahkan kembali** ke status aktif (tabel *Threat Detection*). IP tersebut tertahan dalam kondisi tidak terdefinisi: tidak diblokir, tidak terdeteksi.

**Root Cause:**
- `HandleUnblockIP` di `blocked.go` hanya menghapus IP dari slice in-memory `BlockedIPs`
- Tidak melakukan `UPDATE` kolom `is_blocked` di database `security_logs`
- Tidak me-restore entry ke slice `Threats`

### Masalah 2 — Detection Panel: Tombol Block Non-Aktif & IP Terblokir Masih Muncul
Tombol *Block IP* di *Detection Panel* tidak berfungsi efektif, dan IP yang sudah terblokir tetap tampil di tabel deteksi ancaman.

**Root Cause:**
- `HandleBlockIP` di `detection.go` menambah IP ke `BlockedIPs` tapi **tidak menghapus** dari `Threats` dan **tidak update database**
- `HandleDetectionThreats` mengembalikan **seluruh** threats tanpa mem-filter IP yang sudah terblokir
- Frontend tidak melakukan *optimistic update* setelah block berhasil

---

## Tahapan Perbaikan

### Tahap 1 — Fix `HandleDetectionThreats` (Backend: `detection.go`)

**Perubahan:** Menambahkan filter pada endpoint `GET /api/detection/threats`.

```diff
 func HandleDetectionThreats(store *models.Store) http.HandlerFunc {
     return func(w http.ResponseWriter, r *http.Request) {
         store.Mu.RLock()
         defer store.Mu.RUnlock()
-        helpers.WriteJSON(w, http.StatusOK, map[string]any{"threats": store.Threats})
+        // Build set of blocked IPs
+        blockedSet := make(map[string]bool, len(store.BlockedIPs))
+        for _, b := range store.BlockedIPs {
+            blockedSet[b.IP] = true
+        }
+        // Filter out blocked IPs from response
+        filtered := make([]models.ThreatRow, 0, len(store.Threats))
+        for _, t := range store.Threats {
+            if !blockedSet[t.SourceIP] {
+                filtered = append(filtered, t)
+            }
+        }
+        helpers.WriteJSON(w, http.StatusOK, map[string]any{"threats": filtered})
     }
 }
```

### Tahap 2 — Fix `HandleBlockIP` (Backend: `detection.go`)

**Perubahan:** Menambahkan sinkronisasi database dan pembersihan slice `Threats`.

```diff
 func HandleBlockIP(store *models.Store) http.HandlerFunc {
     // ... input validation ...
+    // 1. Update database: is_blocked = 1
+    database.DB.Exec(
+        "UPDATE security_logs SET is_blocked = 1 WHERE ip_address = ? AND is_blocked = 0",
+        body.IP,
+    )
+
     store.Mu.Lock()
     defer store.Mu.Unlock()
-    blocked := models.BlockedIP{IP: body.IP, BlockedAt: time.Now().Format("15:04")}
-    store.BlockedIPs = append([]models.BlockedIP{blocked}, store.BlockedIPs...)
+    // 2. Check duplicate & add to BlockedIPs
+    // 3. Remove IP from Threats slice
+    newThreats := make([]models.ThreatRow, 0)
+    for _, t := range store.Threats {
+        if t.SourceIP != body.IP {
+            newThreats = append(newThreats, t)
+        }
+    }
+    store.Threats = newThreats
 }
```

### Tahap 3 — Fix `HandleUnblockIP` (Backend: `blocked.go`)

**Perubahan:** Menambahkan sinkronisasi database dan restore threats dari DB.

```diff
 func HandleUnblockIP(store *models.Store) http.HandlerFunc {
     // ... input validation ...
+    // 1. Update database: is_blocked = 0
+    database.DB.Exec(
+        "UPDATE security_logs SET is_blocked = 0 WHERE ip_address = ? AND is_blocked = 1",
+        body.IP,
+    )
+
+    // 2. Re-query DB for this IP's threat entries
+    rows, _ := database.DB.Query(`
+        SELECT action, severity, created_at
+        FROM security_logs
+        WHERE ip_address = ? AND source = 'crowdsec'
+    `, body.IP)
+    // ... scan rows into restoredThreats ...
+
     store.Mu.Lock()
     defer store.Mu.Unlock()
     // Remove from BlockedIPs (existing logic)
+    // 3. Restore threats to in-memory Threats slice
+    store.Threats = append(restoredThreats, store.Threats...)
 }
```

### Tahap 4 — Fix Frontend `DetectionPanel.tsx`

**Perubahan:** Implementasi *optimistic update* dan disabled state pada tombol Block.

```diff
+ const [blockingIps, setBlockingIps] = useState<Set<string>>(new Set());

  const handleBlockIP = useCallback(async (ip: string) => {
+   // Optimistic: immediately remove from local state
+   setBlockingIps((prev) => new Set(prev).add(ip));
+   setThreats((prev) => prev.filter((t) => t.sourceIp !== ip));
    try {
      const res = await fetch(`${API}/api/detection/block`, { ... });
-     if (res.ok) { fetchThreats(); }
+     if (!res.ok) { fetchThreats(); } // Revert on failure
    } catch { fetchThreats(); }
+   finally {
+     setBlockingIps((prev) => { const next = new Set(prev); next.delete(ip); return next; });
+   }
  }, [fetchThreats]);

  // ThreatTable: button disabled + "Blocked" text for IPs being processed
+ <button disabled={blockingIps.has(row.sourceIp)} ... >
+   {blockingIps.has(row.sourceIp) ? 'Blocked' : 'Block IP'}
+ </button>
```

---

## Hasil Akhir

| Fungsionalitas | Sebelum | Sesudah |
|---|---|---|
| **Block IP dari Detection** | IP tetap muncul di tabel deteksi | IP langsung hilang dari tabel deteksi, masuk ke Blocked Panel |
| **Unblock IP dari Blocked Panel** | IP hilang sepenuhnya (lost state) | IP kembali muncul di tabel Detection sebagai threat aktif |
| **Tombol Block** | Non-aktif, tidak ada feedback visual | Menampilkan "Blocked" + disabled state saat proses |
| **Filter Deteksi** | IP terblokir tetap tampil | IP terblokir otomatis difilter dari response API |
| **Sinkronisasi Database** | Kolom `is_blocked` tidak diupdate | `is_blocked` di-update secara real-time (0↔1) |

### File yang Dimodifikasi
1. `Backend/handlers/detection.go` — Filter threats, sinkronisasi block + DB update
2. `Backend/handlers/blocked.go` — Restore threats saat unblock + DB update
3. `Frontend/src/components/DetectionPanel.tsx` — Optimistic UI + disabled button state
