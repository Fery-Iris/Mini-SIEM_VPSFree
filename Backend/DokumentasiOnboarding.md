# Dokumentasi Onboarding & Data Isolation

Sistem Mini-SIEM sekarang mendukung **Multi-Tenant / Self-Service SaaS Onboarding**, yang memungkinkan setiap pengguna (admin) memiliki lingkungan data yang terisolasi sendiri.

## 1. Arsitektur Database (Isolation Model)

Isolasi data dijamin dengan memastikan setiap entri yang masuk memiliki `admin_id` yang sesuai dengan siapa yang sedang login.

### Tabel Baru
- **`organizations`**: Menyimpan data instansi yang didaftarkan.
  - `id` (PK)
  - `name`
  - `created_at`
- **`admins`**: Diperbarui dengan kolom `organization_id` (FK). Setiap registrasi baru akan secara otomatis membuat entri di sini.

### Aturan Isolasi (Data Scoping)
- **`security_logs`**: Setiap *threat log* terkait langsung dengan `admin_id`. Saat menarik data log dan statistik dashboard, API wajib menambahkan filter `WHERE admin_id = ?`.
- **`api_keys`**: `Admin_id` sudah ada dalam skema dan digunakan untuk memfilter dan memverifikasi kepemilikan key.

## 2. API Endpoints

### `POST /api/auth/register`
Mendaftarkan organisasi dan admin baru.

**Request:**
```json
{
  "organizationName": "PT Keamanan Digital",
  "email": "admin@keamanan.com",
  "password": "secretpassword"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "adminId": 2,
  "email": "admin@keamanan.com",
  "organizationId": 1,
  "organizationName": "PT Keamanan Digital"
}
```

### `POST /api/auth/login`
Autentikasi admin dan mengembalikan konteks lingkungan (*scope*).

**Request:**
```json
{
  "email": "admin@keamanan.com",
  "password": "secretpassword"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "email": "admin@keamanan.com",
  "adminId": 2,
  "organizationId": 1,
  "organizationName": "PT Keamanan Digital"
}
```

## 3. Frontend Integration (React)

Pada saat proses autentikasi (login atau daftar) berhasil, data kunci disimpan di `localStorage` pada browser klien:
- `userEmail`
- `adminId`
- `orgId`
- `orgName`

Nilai `adminId` ini akan diambil oleh komponen (misalnya, `Dashboard.tsx` dan `GetApiKey.tsx`) dan diteruskan sebagai parameter (*query parameter* atau *body*) ke setiap permintaan ke Backend untuk memastikan bahwa pengguna hanya dapat melihat dan memodifikasi data milik mereka sendiri.

## 4. Pengujian / Testing

Anda dapat menguji proses menggunakan antarmuka pengguna pada halaman `/signin` yang telah mendukung model **Sign In** dan **Daftar** pada *tab* yang berbeda, atau menggunakan `curl`/`PowerShell` berikut:

```powershell
# Uji Registrasi
$body = @{
    organizationName = "XR Corp"
    email = "user@xrcorp.com"
    password = "securePassword123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8081/api/auth/register" -Method Post -Body $body -ContentType "application/json"
```

## 5. Pertanyaan Umum (FAQ)

**T: Apa yang terjadi pada data lama (Seed Data)?**
**J:** Data default menggunakan `admin_id=1`. Jadi pengguna yang masuk menggunakan kredensial lama (`admin@xrsecurity.com`) tetap akan melihat data tersebut. Pengguna yang mendaftar baru tidak akan bisa melihat data dari pengguna lama.

**T: Apakah pembuatan *API Key* terpisah setiap pengguna?**
**J:** Ya. Endpoint `/api/apikeys/generate` kini menerima `adminId` dari permintaan dan menautkan API key ke admin tersebut.
