# Dokumentasi Halaman Sign In (Sign Up) — Mini SIEM

Dokumen ini menjelaskan komponen frontend **SignInPage** yang berfungsi sebagai halaman registrasi akun baru untuk platform XR Security.

---

## Informasi Umum

| Item | Detail |
|------|--------|
| **File** | `frontend/src/components/SignInPage.tsx` |
| **Route** | `/signin` |
| **Tipe Komponen** | React Functional Component (TypeScript) |
| **Export** | `export default SignInPage` |
| **Styling** | Tailwind CSS v4 (tanpa CSS eksternal) |
| **Icon Library** | `lucide-react` |

---

## Arsitektur Layout

Halaman menggunakan **split-screen layout** (dua kolom) dengan desain estetik cybersecurity SaaS:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Full Screen (flex)                       │
│                                                                 │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐  │
│  │     LEFT PANEL (55%)     │  │     RIGHT PANEL (45%)       │  │
│  │                          │  │                             │  │
│  │  ┌── Logo ──────────┐   │  │  ┌── Header ─────────────┐  │  │
│  │  │ 🛡 XR Security   │   │  │  │ "Create your account" │  │  │
│  │  └──────────────────┘   │  │  │ Subtitle              │  │  │
│  │                          │  │  └───────────────────────┘  │  │
│  │  ┌── Dashboard Grid ─┐  │  │                             │  │
│  │  │ (Mockup dekoratif)│  │  │  ┌── Form ───────────────┐  │  │
│  │  │ 6 kartu preview   │  │  │  │ Full Name     [👤]    │  │  │
│  │  └───────────────────┘  │  │  │ Email         [✉️]    │  │  │
│  │                          │  │  │ Password      [👁🔒]  │  │  │
│  │  ┌── AnimatedCircles ─┐  │  │  │ Confirm Pass  [👁🔒]  │  │  │
│  │  │ (Partikel animasi) │  │  │  │                       │  │  │
│  │  └────────────────────┘  │  │  │ [ Sign Up Button ]    │  │  │
│  │                          │  │  └───────────────────────┘  │  │
│  │  ┌── Heading ─────────┐  │  │                             │  │
│  │  │ "4x Your Threat    │  │  │  ────── or ──────           │  │
│  │  │  Visibility"       │  │  │                             │  │
│  │  │                    │  │  │  [ Sign up with Google ]    │  │
│  │  │ ✅ Bullet point 1  │  │  │                             │  │
│  │  │ ✅ Bullet point 2  │  │  │  Already have an account?   │  │
│  │  └────────────────────┘  │  │  → Login                    │  │
│  │                          │  │                             │  │
│  │  Background:             │  │  ┌── Footer ─────────────┐  │  │
│  │  - Gradient biru/ungu    │  │  │ Terms · Privacy · Help │  │  │
│  │  - Glowing orbs          │  │  │ · English ▾            │  │  │
│  │  - Dot-grid pattern      │  │  └───────────────────────┘  │  │
│  └──────────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Responsivitas

| Breakpoint | Layout | Keterangan |
|------------|--------|------------|
| **Desktop** (`lg:` ≥ 1024px) | 2 kolom sejajar (55% + 45%) | Split-screen penuh |
| **Mobile** (< 1024px) | Stack vertikal (`flex-col-reverse`) | Form ditampilkan **di atas**, panel visual di bawah |

---

## Panel Kiri — Visual / Branding

Panel kiri menampilkan identitas merek XR Security dengan efek visual futuristik.

### Komponen Visual

| Elemen | Deskripsi | Detail Teknis |
|--------|-----------|---------------|
| **Background Gradient** | Gradien gelap biru/ungu | `bg-gradient-to-br from-indigo-950 via-slate-950 to-blue-950` |
| **Grain Noise** | Efek tekstur noise halus | URL SVG dengan `opacity-[0.06]` dan `mix-blend-overlay` |
| **Glowing Orbs** | 3 bola cahaya besar (biru, indigo, violet) | `blur-[80–100px]` dengan opacity rendah |
| **Dot-Grid Pattern** | Pola titik-titik cyber | `radial-gradient` 24×24px dengan mask fade |
| **Dashboard Mockup Grid** | 6 kartu preview dashboard (dekoratif) | Grid 2–3 kolom, `opacity-30–40`, fade-out gradient ke bawah |
| **AnimatedCircles** | Partikel lingkaran interaktif (mengikuti kursor) | Komponen terpisah: `AnimatedCircles.tsx` |

### Konten Teks

| Elemen | Isi |
|--------|-----|
| **Logo** | Ikon Shield + "XR Security" (posisi kiri atas) |
| **Heading** | "**4x** Your Threat Visibility" — "4x" menggunakan gradient teks (amber → putih → biru) |
| **Bullet 1** | ✅ "**The most advanced SIEM platform** for real-time threat monitoring and response" |
| **Bullet 2** | ✅ "**Secure your entire organization** with cutting-edge AI and automation" |

---

## Panel Kanan — Formulir Sign Up

### Header

| Elemen | Isi |
|--------|-----|
| **Judul** | "Create your account" |
| **Subtitle** | "Join XR Security and start securing your organization" |

### Form Fields

Semua field menggunakan **controlled inputs** (`useState`) dengan styling konsisten.

| # | Field | ID | Tipe | Icon | Placeholder | Required |
|---|-------|----|------|------|-------------|----------|
| 1 | Full Name | `signin-fullname` | `text` | `User` (lucide) | "e.g. John Doe" | ✅ |
| 2 | Email | `signin-email` | `email` | `Mail` (lucide) | "e.g. john@company.com" | ✅ |
| 3 | Password | `signin-password` | `password` / `text` | `Eye`/`EyeOff` + `Lock` | "Min. 8 characters" | ✅ |
| 4 | Confirm Password | `signin-confirm-password` | `password` / `text` | `Eye`/`EyeOff` + `Lock` | "Re-enter your password" | ✅ |

### Styling Input Field

```
Setiap input menggunakan class Tailwind berikut:
- Rounded: rounded-xl
- Padding: px-4 py-3.5 (pr-12 atau pr-20 untuk field dengan icon)
- Border: border border-slate-200
- Focus: focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
- Shadow: shadow-sm shadow-slate-100/50
- Font: text-sm font-medium text-slate-900
```

### Password Visibility Toggle

Field Password dan Confirm Password memiliki tombol **show/hide** yang menggunakan ikon `Eye` dan `EyeOff` dari lucide-react. State dikontrol oleh:
- `showPassword` → untuk field Password
- `showConfirmPassword` → untuk field Confirm Password

### Tombol & Aksi

| Elemen | ID | Teks | Styling | Aksi |
|--------|----|------|---------|------|
| **Sign Up** (primary) | `signin-submit-btn` | "Sign Up" / "Creating account..." | Gradient biru, `shadow-lg`, hover lift (`-translate-y-0.5`) | Submit form → `console.log()` |
| **Google Sign Up** | `signin-google-btn` | "Sign up with Google" | Border putih, ikon Google SVG, hover lift | `console.log('Google Sign Up clicked')` |
| **Login link** | `signin-login-link` | "Login" | Teks biru, underline on hover | Navigasi ke `/login` |

### Divider

Garis horizontal dengan teks "**or**" di tengah, memisahkan form utama dari opsi social login.

---

## State Management

Komponen menggunakan `useState` untuk mengelola semua state internal:

| State | Tipe | Default | Fungsi |
|-------|------|---------|--------|
| `fullName` | `string` | `''` | Menyimpan input nama lengkap |
| `email` | `string` | `''` | Menyimpan input email |
| `password` | `string` | `''` | Menyimpan input password |
| `confirmPassword` | `string` | `''` | Menyimpan input konfirmasi password |
| `showPassword` | `boolean` | `false` | Toggle visibilitas password |
| `showConfirmPassword` | `boolean` | `false` | Toggle visibilitas konfirmasi password |
| `error` | `string` | `''` | Pesan error validasi |
| `isLoading` | `boolean` | `false` | Status loading saat submit |

---

## Validasi Form

Validasi dilakukan di sisi client pada fungsi `handleSubmit`:

| Validasi | Pesan Error | Prioritas |
|----------|-------------|-----------|
| Password ≠ Confirm Password | "Passwords do not match." | 1 (dicek pertama) |
| Password < 8 karakter | "Password must be at least 8 characters." | 2 |

Error ditampilkan sebagai banner merah dengan ikon peringatan di atas form, menggunakan animasi `shake`.

---

## Alur Submit Form

```
User mengisi form → Klik "Sign Up"
         │
         ▼
    preventDefault()
    setError('')
         │
         ▼
  ┌──────────────────────┐
  │ Password = Confirm?  │──── NO ──→ setError("Passwords do not match.")
  └──────────────────────┘
         │ YES
         ▼
  ┌──────────────────────┐
  │ Password.length ≥ 8? │──── NO ──→ setError("Password must be at least 8 characters.")
  └──────────────────────┘
         │ YES
         ▼
    setIsLoading(true)
    console.log({ fullName, email, password })
         │
         ▼
    setTimeout(1500ms)
    setIsLoading(false)
    console.log("Account creation submitted successfully.")
```

> **Catatan:** Saat ini form hanya melakukan `console.log()`. Untuk produksi, ganti dengan panggilan API ke backend.

---

## Dependencies

| Package | Versi | Kegunaan |
|---------|-------|----------|
| `react` | 19.x | Framework UI |
| `typescript` | 5.x | Type safety |
| `tailwindcss` | 4.x | Styling utility-first |
| `lucide-react` | 1.6.x | Ikon SVG (Shield, User, Mail, Lock, Eye, EyeOff, CheckCircle2, ChevronDown) |

### Komponen Internal

| Komponen | File | Kegunaan |
|----------|------|----------|
| `AnimatedCircles` | `components/AnimatedCircles.tsx` | Partikel lingkaran animasi pada panel kiri (mengikuti posisi kursor mouse) |

---

## Routing

File `App.tsx` telah diperbarui untuk menyertakan route Sign In:

```tsx
// App.tsx
import SignInPage from './components/SignInPage';

// Di dalam <Routes>:
<Route path="/signin" element={<SignInPage />} />
```

### Navigasi Antar Halaman

| Dari | Ke | Elemen |
|------|----|--------|
| Sign In Page (`/signin`) | Login Page (`/login`) | Link "Already have an account? **Login**" |
| Login Page (`/login`) | Sign In Page (`/signin`) | Link "Don't have an account? **Sign up**" |

---

## Mapping Handler ↔ Frontend (Update)

Tabel mapping yang sudah diperbarui dengan tambahan halaman Sign In:

| Handler File | Frontend Component | Route |
|--------------|--------------------|-------|
| `handlers/login.go` | `Login.tsx` | `/login` |
| — (belum ada handler) | `SignInPage.tsx` | `/signin` |
| `handlers/dashboard.go` | `Dashboard.tsx` | `/dashboard` |
| `handlers/detection.go` | `DetectionPanel.tsx` | `/detection` |
| `handlers/blocked.go` | `BlockedPanel.tsx` | `/blocked` |
| `handlers/apikeys.go` | `GetApiKey.tsx` | `/apikey` |

> **Catatan:** Saat ini belum ada handler backend untuk registrasi akun (`/api/auth/register`). Form hanya melakukan `console.log()`. Untuk mengaktifkan fitur registrasi secara penuh, perlu dibuat endpoint baru di backend.

---

## Kustomisasi

### Mengubah Teks

Semua teks konten (heading, bullet points, label, placeholder) dapat diubah langsung di file `SignInPage.tsx`. Tidak ada file konfigurasi terpisah.

### Menambah/Menghapus Field

Untuk menambah field baru:
1. Tambahkan state baru: `const [namaField, setNamaField] = useState('');`
2. Salin blok `<div className="space-y-1.5">...</div>` dari field yang sudah ada
3. Ubah `id`, `label`, `placeholder`, dan `onChange` sesuai kebutuhan
4. Tambahkan field ke objek `console.log` di `handleSubmit`

### Menghubungkan ke API Backend

Ganti blok berikut di fungsi `handleSubmit`:

```tsx
// SEBELUM (console.log saja):
console.log('Sign Up Data:', { fullName, email, password });
setTimeout(() => { setIsLoading(false); }, 1500);

// SESUDAH (panggilan API):
const response = await fetch('http://localhost:8081/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fullName, email, password }),
});
const data = await response.json();
if (data.success) {
  // Redirect ke login atau dashboard
} else {
  setError(data.message);
}
setIsLoading(false);
```

### Mengganti Social Login

Untuk menambah provider OAuth lain (GitHub, Microsoft, dll), salin tombol Google dan ganti:
- Ikon SVG
- Teks tombol
- Handler `onClick`

---

## Efek Visual & Animasi

| Efek | Elemen | Detail |
|------|--------|--------|
| **Hover lift** | Tombol Sign Up, Google | `hover:-translate-y-0.5` + shadow yang membesar |
| **Active press** | Semua tombol | `active:scale-[0.98]` |
| **Loading spinner** | Tombol Sign Up | SVG spinner dengan `animate-spin` |
| **Error shake** | Banner error | `animate-[shake_0.3s_ease-in-out]` |
| **Focus ring** | Semua input | `focus:ring-2 focus:ring-blue-500/20` |
| **Glowing orbs** | Panel kiri | `blur-[80–100px]` dengan warna biru/indigo/violet |
| **Dashboard grid hover** | Panel kiri | `group-hover:opacity-50` (opacity naik saat hover panel) |
| **Particle circles** | Panel kiri | `AnimatedCircles` — lingkaran menyala mengikuti kursor mouse |

---

## Screenshot

Halaman dapat diakses di: **`http://localhost:5173/signin`**

Layout desktop menampilkan:
- **Panel kiri**: Background gelap dengan gradient biru/ungu, logo XR Security, heading "4x Your Threat Visibility", dan dua bullet point dengan ikon centang hijau
- **Panel kanan**: Form putih dengan 4 field input (Full Name, Email, Password, Confirm Password), tombol "Sign Up" gradient biru, divider "or", tombol "Sign up with Google", dan link ke halaman Login
