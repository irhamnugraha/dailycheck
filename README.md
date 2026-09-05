# Checklist Rutinitas Keluarga

Aplikasi checklist rutinitas harian anak — React + Vite, data tersimpan di Supabase.

## 1. Sebelum push ke GitHub — cek nama repo

File `vite.config.js` punya baris ini:

```js
base: "/family-routine-checklist/",
```

Ini **harus sama persis** dengan nama repo GitHub Anda, karena begitulah cara GitHub Pages menyusun URL project:
`https://<username-anda>.github.io/<nama-repo>/`

- Kalau nama repo Anda memang `family-routine-checklist` → tidak perlu ubah apa-apa.
- Kalau Anda pakai nama repo lain (misal `checklist-anak`) → ubah baris di atas jadi `base: "/checklist-anak/",`.
- Kalau Anda deploy ke repo khusus User/Org Pages (namanya `<username-anda>.github.io`) → ubah jadi `base: "/",`.

## 2. Push ke GitHub

Dari folder project ini:

```bash
git init
git add .
git commit -m "Initial commit: family routine checklist app"
git branch -M main
git remote add origin https://github.com/<username-anda>/<nama-repo>.git
git push -u origin main
```

## 3. Aktifkan GitHub Pages

Di repo GitHub Anda:
1. Buka **Settings → Pages**
2. Bagian **Source**, pilih **GitHub Actions** (bukan "Deploy from a branch")
3. Push ke branch `main` akan otomatis memicu build & deploy lewat workflow yang sudah disertakan (`.github/workflows/deploy.yml`)
4. Setelah workflow selesai (cek tab **Actions**), situsnya bisa diakses di `https://<username-anda>.github.io/<nama-repo>/`

## 4. Coba jalankan di komputer sendiri dulu (opsional tapi disarankan)

```bash
npm install
npm run dev
```

Buka `http://localhost:5173` — pastikan checklist, kalender, dan jadwal shalat berjalan normal sebelum di-deploy.

## Tentang keamanan akses

Aplikasi ini **tidak punya sistem login**. Semua orang yang tahu URL GitHub Pages-nya bisa membuka aplikasinya, dan siapa pun yang membaca kode JavaScript-nya bisa juga memanggil API Supabase langsung (lewat kunci `anon` yang memang publik) — PIN 4 digit di dalam aplikasi hanya mengunci tampilan menu Pengaturan, **bukan** database-nya. Ini sesuai keputusan yang sudah diambil: cukup andalkan URL yang tidak disebarluaskan. Kalau nanti mau ditambah keamanan sungguhan (login email/password), beri tahu saja.

## Tentang Supabase

- Project: `family-routine-checklist` (region Singapura), sudah dibuatkan dan terhubung lewat `src/supabaseClient.js`
- Skema tabel: `app_settings`, `periods`, `children`, `tasks`, `events`, `violations`
- Kalau mau lihat/ubah data langsung, buka [Supabase Dashboard](https://supabase.com/dashboard) → project `family-routine-checklist` → Table Editor
- Data pertama kali kosong (belum ada anak) — tambahkan anak pertama lewat menu Pengaturan setelah aplikasi online

## Struktur Project

```
├── src/
│   ├── App.jsx           ← seluruh aplikasi (dashboard, checklist, kalender, pengaturan, dll)
│   ├── supabaseClient.js ← koneksi ke Supabase
│   ├── dataStore.js      ← fungsi ambil/simpan data dari & ke Supabase
│   ├── main.jsx
│   └── index.css
├── .github/workflows/deploy.yml  ← otomatis build & deploy tiap push ke main
├── vite.config.js
└── package.json
```
