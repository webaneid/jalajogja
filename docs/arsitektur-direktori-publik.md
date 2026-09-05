# Arsitektur Direktori Publik

Empat halaman front-end publik yang menampilkan data anggota, pesantren, usaha, dan statistik IKPM.
Semua halaman masuk ke route group `(public)/[tenant]/` — tidak butuh login, tampil di website organisasi.

---

## Daftar Halaman

| Halaman | URL | Keterangan |
|---------|-----|------------|
| Direktori Anggota | `/{slug}/anggota` | List + popup detail |
| Direktori Pesantren | `/{slug}/pesantren` | List + halaman detail |
| Direktori Usaha | `/{slug}/usaha` | List + halaman detail |
| Statistik | `/{slug}/statistik` | Dashboard angka & grafik |

## Paginasi — Berlaku di Semua List

Ketiga halaman list (Anggota, Pesantren, Usaha) wajib menggunakan paginasi server-side berbasis URL.

**Spesifikasi:**
- Page size: **24** untuk kartu grid (kelipatan 4 kolom), **20** untuk list view
- Parameter URL: `?page=N` (default 1)
- Query: `LIMIT PAGE_SIZE OFFSET (page-1)*PAGE_SIZE`
- Total count: satu query `COUNT(*)` paralel
- Navigasi: tombol Sebelumnya / nomor halaman / Berikutnya
- Filter dan search mempertahankan `page` di-reset ke 1 setiap kali filter berubah

**Pattern URL:**
```
/{slug}/anggota?page=2&provinsi=34&angkatan=2005
/{slug}/pesantren?page=1&kurikulum=KMI+Gontor
/{slug}/usaha?page=3&sektor=Teknologi
```

Paginasi TIDAK menggunakan infinite scroll atau client-side load-more — semua server-side
agar SEO-friendly dan bekerja tanpa JavaScript.

---

## 1. Aturan Visibilitas Data

### 1a. Data Anggota (`public.members`)

**Selalu tampil publik:**
| Field | Sumber | Catatan |
|-------|--------|---------|
| `name` | `members.name` | Nama lengkap |
| `photoUrl` | `members.photo_url` | Foto profil, fallback initials avatar |
| `gender` | `members.gender` | "male"/"female" → label Indonesia |
| `graduationYear` | `members.graduation_year` | Angkatan |
| `graduationPeriod` | `members.graduation_period` | Hanya jika tahun = 1999 (awal/akhir) |
| Profesi | `members.profession_id → ref_professions.name` | Nama + kategori profesi |
| Domisili (provinsi + kabupaten) | `addresses.province_id`, `addresses.regency_id` | Hanya 2 level teratas |
| Tempat lahir (provinsi saja) | `birth_regency_id → ref_regencies.province_id` | Hanya provinsi asal |
| Social media | `social_medias.*` | Semua platform yang diisi, seluruhnya publik |

**Tampil publik berdasarkan pilihan anggota:**
| Field | Kontrol visibilitas |
|-------|---------------------|
| Nomor HP | `contacts.is_phone_public = true` |
| WhatsApp | `contacts.is_whatsapp_public = true` |
| Email | `contacts.is_email_public = true` |

**Tidak pernah tampil publik (private):**
| Field | Alasan |
|-------|--------|
| `nik` | Data kependudukan sensitif |
| `birthDate` (tanggal+bulan) | Data pribadi — hanya tahun lahir boleh ditampilkan |
| `memberNumber` | ID internal organisasi |
| `stambukNumber` | Opsional — bisa ditampilkan jika anggota mau (toggle ke depan) |
| Detail alamat (jalan, RT/RW, kecamatan, desa) | Lokasi spesifik sensitif |
| `homeAddressId`, `contactId`, `socialMediaId` | ID internal, bukan data |
| `betterAuthUserId`, `domicileTenantId` | Data sistem internal |

**Scope tenant:**
Direktori anggota hanya menampilkan member yang punya `tenant_memberships.tenant_id = current_tenant`,
bukan seluruh anggota IKPM lintas cabang. Global directory = fitur platform masa depan.

---

### 1b. Data Pesantren (`public.member_owned_pesantren`)

**Selalu tampil publik:**
| Field | Catatan |
|-------|---------|
| `name` | Nama pesantren |
| `tahunBerdiri` | Tahun berdiri |
| `luasArea` | Free text ("2 hektar") |
| `namaPimpinan` | Nama pimpinan |
| `kurikulum` | KMI Gontor / DIKNAS / dll |
| `jenisPondok` | Wakaf / Milik Keluarga |
| `modelPendidikan` | Murni KMI Gontor / dll |
| `kategoriSantri` | Putra / Putri / Putra dan Putri |
| `santriPutra`, `santriPutri` | Jumlah santri |
| `asatidz`, `asatidzah` | Jumlah pengajar |
| `coverUrl` | Foto pesantren |
| Alamat (provinsi + kabupaten) | Dari `addresses.province_id`, `addresses.regency_id` |
| Social media | Dari `social_medias.*` — semua platform yang diisi |
| Info pemilik | Link ke profil anggota IKPM pemilik pesantren |

**Tampil publik berdasarkan toggle pesantren (dari `contacts`):**
| Field | Kontrol visibilitas |
|-------|---------------------|
| Nomor HP pesantren | `contacts.is_phone_public` pada `contactId` pesantren |
| WhatsApp pesantren | `contacts.is_whatsapp_public` |

**Tidak pernah tampil publik:**
| Field | Alasan |
|-------|--------|
| `hpPimpinan` | Nomor pribadi pimpinan — tidak ada toggle, **tidak ditampilkan** |
| Email pesantren | `contacts.is_email_public` ada di kolom & sudah dicek di query publik, TAPI **tidak ada UI** untuk mengaktifkannya (admin wizard maupun self-service `/akun/pesantren` cuma punya toggle HP+WA) — nilainya selalu default `false`, email tidak pernah bisa tampil. **Keputusan disengaja** (dikonfirmasi 2026-07-23, lihat lesson CLAUDE.md), bukan bug — jangan ditambahkan tanpa konfirmasi ulang. |
| Detail alamat (jalan, kecamatan, desa) | Cukup provinsi + kabupaten |

---

### 1c. Data Usaha (`public.member_businesses`)

**Selalu tampil publik:**
| Field | Catatan |
|-------|---------|
| `name` | Nama usaha |
| `brand` | Merek (jika ada) |
| `description` | Deskripsi usaha |
| `category` | Jasa / Produsen / Distributor / Trading / Profesional |
| `sector` | Teknologi / Jasa Profesional / dll |
| `legality` | PT / CV / Yayasan / dll |
| `position` | Peran pemilik di usaha |
| `employees` | Range jumlah karyawan |
| `branches` | Jumlah cabang |
| `coverUrl` | Foto usaha |
| Alamat (provinsi + kabupaten) | Dari `addresses.*` |
| Social media | Dari `social_medias.*` |
| Pemilik | Link ke profil anggota IKPM |

**Tampil publik berdasarkan toggle:**
| Field | Kontrol visibilitas |
|-------|---------------------|
| HP usaha | `contacts.is_phone_public` pada `contactId` usaha |
| WhatsApp usaha | `contacts.is_whatsapp_public` |

**Tidak pernah tampil publik:**
| Field | Alasan |
|-------|--------|
| `revenue` | Informasi finansial — terlalu sensitif meski berupa range |
| Email usaha | Sama seperti pesantren — kolom `is_email_public` ada tapi tidak ada UI untuk mengaktifkannya di mana pun (admin wizard `step4-business.tsx` bahkan tidak punya toggle HP/WA sama sekali, hanya self-service `/akun/usaha` yang punya, dan itu pun cuma HP+WA). **Keputusan disengaja** (2026-07-23) — jangan ditambahkan tanpa konfirmasi ulang. |
| Detail alamat (jalan, kecamatan, desa) | Cukup provinsi + kabupaten |

**Catatan wewenang toggle (berlaku semua entitas di atas)**: siapa yang boleh mencentang
"Publik" berbeda per entitas, dan ini disengaja, bukan inkonsistensi yang perlu diseragamkan:
- **Usaha** — HANYA pemilik usaha sendiri via `/akun/usaha` (admin wizard `step4-business.tsx`
  tidak punya toggle visibilitas sama sekali — pengurus tidak bisa membuat kontak usaha anggota
  jadi publik atas nama mereka, sengaja dibiarkan seperti ini).
- **Anggota (kontak pribadi) & Pesantren** — pengurus/admin dashboard BOLEH mencentang toggle ini
  atas nama anggota (via `step2-contact.tsx`/`step5-pesantren.tsx`), diperlakukan sebagai
  wewenang administratif normal pengurus mengelola data anggota di cabangnya. **Dikonfirmasi
  eksplisit oleh user 2026-07-23** — bukan celah consent yang perlu ditutup, meski beda dari
  pola Usaha di atas.

---

## 2. Direktori Anggota — `/{slug}/anggota`

### Query utama (list)
```sql
SELECT
  m.id, m.name, m.photo_url, m.gender, m.graduation_year, m.graduation_period,
  rp.name AS profession_name, rpc.category AS profession_category,
  prov.name AS domicile_province, reg.name AS domicile_regency
FROM members m
INNER JOIN tenant_memberships tm ON tm.member_id = m.id AND tm.tenant_id = {tenantId}
LEFT JOIN ref_professions rp ON rp.id = m.profession_id
LEFT JOIN addresses addr ON addr.id = m.home_address_id
LEFT JOIN ref_provinces prov ON prov.id = addr.province_id
LEFT JOIN ref_regencies reg ON reg.id = addr.regency_id
WHERE tm.status IN ('active', 'alumni')
ORDER BY m.name ASC
```

### Filter yang tersedia
- Provinsi domisili (dropdown)
- Angkatan / graduation year (range atau pilih tahun)
- Kategori profesi
- Status (Aktif / Alumni / Semua)

### Search
- Nama anggota (ILIKE)

### Popup detail — data tambahan yang difetch saat klik
```sql
-- Kontak (hanya yang public)
SELECT phone, whatsapp, email, is_phone_public, is_whatsapp_public, is_email_public
FROM contacts WHERE id = m.contact_id

-- Social media
SELECT * FROM social_medias WHERE id = m.social_media_id

-- Pesantren milik (ringkasan)
SELECT id, name, kurikulum FROM member_owned_pesantren WHERE member_id = m.id LIMIT 3

-- Usaha (ringkasan)
SELECT id, name, sector, category FROM member_businesses WHERE member_id = m.id AND is_active = true LIMIT 3
```

### UI Component
- Grid kartu: foto avatar (bulat) + nama + profesi + provinsi + angkatan
- Popup: foto lebih besar + data lengkap + kontak (conditional) + sosmed + ringkasan usaha/pesantren
- Pagination: 24 kartu per halaman
- Filter sidebar (desktop) / filter sheet (mobile)

---

## 3. Direktori Pesantren — `/{slug}/pesantren` + `/{slug}/pesantren/[id]`

### Query list
```sql
SELECT
  p.id, p.name, p.cover_url, p.kurikulum, p.model_pendidikan,
  p.kategori_santri, p.tahun_berdiri,
  (p.santri_putra + p.santri_putri) AS total_santri,
  prov.name AS province_name, reg.name AS regency_name,
  m.name AS owner_name, m.id AS owner_id
FROM member_owned_pesantren p
INNER JOIN members m ON m.id = p.member_id
INNER JOIN tenant_memberships tm ON tm.member_id = m.id AND tm.tenant_id = {tenantId}
LEFT JOIN addresses addr ON addr.id = p.address_id
LEFT JOIN ref_provinces prov ON prov.id = addr.province_id
LEFT JOIN ref_regencies reg ON reg.id = addr.regency_id
WHERE tm.status IN ('active', 'alumni')
ORDER BY p.name ASC
```

### Filter
- Provinsi
- Kurikulum (KMI Gontor / DIKNAS / KEMENAG / Salafiah / Lainnya)
- Model pendidikan
- Kategori santri (Putra / Putri / Campuran)

### Search
- Nama pesantren, nama pimpinan

### Halaman detail `/{slug}/pesantren/[id]`
Tampilkan semua field publik + kontak conditional + sosmed + peta wilayah (provinsi/kab) + link profil pemilik.

---

## 4. Direktori Usaha — `/{slug}/usaha`

### Query list
```sql
SELECT
  b.id, b.name, b.brand, b.description, b.cover_url,
  b.category, b.sector, b.legality, b.employees, b.branches,
  prov.name AS province_name, reg.name AS regency_name,
  m.name AS owner_name, m.id AS owner_id, m.photo_url AS owner_photo
FROM member_businesses b
INNER JOIN members m ON m.id = b.member_id
INNER JOIN tenant_memberships tm ON tm.member_id = m.id AND tm.tenant_id = {tenantId}
LEFT JOIN addresses addr ON addr.id = b.address_id
LEFT JOIN ref_provinces prov ON prov.id = addr.province_id
LEFT JOIN ref_regencies reg ON reg.id = addr.regency_id
WHERE b.is_active = true AND tm.status IN ('active', 'alumni')
ORDER BY b.name ASC
```

### Filter
- Sektor
- Kategori (Jasa / Produsen / dll)
- Provinsi
- Legalitas

### Search
- Nama usaha, nama brand, nama pemilik

### Detail
Popup besar atau halaman terpisah: foto + deskripsi + data klasifikasi + kontak conditional + sosmed + pemilik.

---

## 5. Statistik — `/{slug}/statistik`

### Data yang dihitung

**Statistik Anggota:**
| Metrik | Query |
|--------|-------|
| Total anggota aktif | COUNT WHERE status='active' |
| Total anggota alumni | COUNT WHERE status='alumni' |
| Distribusi per provinsi | GROUP BY province_id |
| Distribusi per angkatan | GROUP BY graduation_year |
| Distribusi per kategori profesi | GROUP BY profession category |
| Komposisi gender | COUNT GROUP BY gender |
| Punya usaha | COUNT DISTINCT member_id dari member_businesses |
| Punya pesantren | COUNT DISTINCT member_id dari member_owned_pesantren |
| Latar belakang wali santri | GROUP BY wali_santri |

> **Koreksi "Distribusi per provinsi" (anggota):** implementasi aktual sudah pindah ke
> kabupaten/kota (`refRegencies`), bukan provinsi — granularitas lebih berguna untuk domisili
> anggota. Wajib filter `WHERE refRegencies.id IS NOT NULL` (tanpa ini anggota tanpa alamat masuk
> dengan nama null dan merusak label BarList). Aturan umum: setiap kolom nullable di statistik
> (waliSantri, domicileStatus, employees, branches, graduationYear, dll) wajib filter
> `IS NOT NULL` — jangan tampilkan "Tidak diketahui" sebagai bar besar hanya karena banyak
> anggota belum isi data.
>
> **Sub-periode angkatan 1999:** Gontor punya dua angkatan di tahun 1999 (Awal/Akhir) — kolom
> `graduation_period TEXT CHECK (graduation_period IN ('awal','akhir'))` di `public.members`.
> Query statistik wajib `GROUP BY members.graduationYear, members.graduationPeriod` bersamaan
> (tidak bisa group hanya by year untuk kasus 1999). Label display 3 kemungkinan: "1999 (Awal)",
> "1999 (Akhir)", atau "1999 (Belum ditentukan)" — kasus terakhir adalah data lama sebelum kolom
> period ditambahkan (sinyal data lama yang perlu diupdate via `/akun/lengkapi`, bukan error,
> jangan disembunyikan/digabung). Validasi form: `graduationPeriod` wajib diisi jika
> `graduationYear === 1999`, berlaku di `app/(public)/[tenant]/akun/lengkapi/page.tsx` dan
> `components/members/wizard/step1-identity.tsx`.

**Statistik Pesantren:**
| Metrik | Query |
|--------|-------|
| Total pesantren | COUNT member_owned_pesantren |
| Total santri (akumulasi) | SUM(santri_putra + santri_putri) |
| Total pengajar (akumulasi) | SUM(asatidz + asatidzah) |
| Distribusi per kurikulum | GROUP BY kurikulum |
| Distribusi per model pendidikan | GROUP BY model_pendidikan |
| Distribusi per provinsi | GROUP BY province |
| Distribusi per kategori santri | GROUP BY kategori_santri |
| Jenis pondok | GROUP BY jenis_pondok |

**Statistik Usaha:**
| Metrik | Query |
|--------|-------|
| Total usaha aktif | COUNT is_active=true |
| Distribusi per sektor | GROUP BY sector |
| Distribusi per kategori | GROUP BY category |
| Distribusi per legalitas | GROUP BY legality |
| Distribusi per skala karyawan | GROUP BY employees |
| Distribusi per provinsi | GROUP BY province |
| Anggota yang memiliki usaha | COUNT DISTINCT member_id |

### UI
- Angka besar (highlight card) untuk total
- Bar chart horizontal untuk distribusi
- Pie/donut chart untuk komposisi (gender, kategori, kurikulum)
- Semua data diambil server-side, tidak ada chart library interaktif — pakai SVG statis atau CSS-only bar chart untuk performa

---

## 6. Route Group & File Structure

```
app/(public)/[tenant]/
├── anggota/
│   └── page.tsx                  → direktori anggota (list + popup)
├── pesantren/
│   ├── page.tsx                  → list pesantren
│   └── [id]/
│       └── page.tsx              → detail pesantren
├── usaha/
│   ├── page.tsx                  → list usaha
│   └── [id]/
│       └── page.tsx              → detail usaha
└── statistik/
    └── page.tsx                  → halaman statistik
```

### API Routes (jika diperlukan untuk popup data)
```
GET /api/akun/member-public/[id]?slug=   → profil publik anggota (untuk popup)
```

---

## 7. Arsitektur Popup Detail Anggota

Popup (Dialog shadcn/ui) di-trigger saat klik kartu anggota. Data detail difetch on-demand:

```typescript
// Client component — klik kartu → set selectedMemberId → Dialog terbuka → fetch
const [selectedId, setSelectedId] = useState<string | null>(null);

// Data popup (lazy fetch saat Dialog open)
useEffect(() => {
  if (!selectedId) return;
  fetch(`/api/member-public/${selectedId}?slug=${slug}`).then(...)
}, [selectedId]);
```

**API endpoint `/api/member-public/[id]`:**
- Tidak perlu auth (publik)
- Hanya return field yang public (sesuai aturan visibilitas §1a)
- Kontak hanya jika `is_*_public = true`
- Tambah scope check: `member_id` harus ada di `tenant_memberships` untuk tenant ini

---

## 8. Navigasi & Header Menu

Keempat halaman ditambahkan ke `nav-menu.ts` dan menu header front-end sebagai sub-menu atau menu utama. Nama menu yang disarankan:
- **"Anggota"** → `/{slug}/anggota`
- **"Pesantren"** → `/{slug}/pesantren`
- **"Direktori Usaha"** → `/{slug}/usaha`
- **"Statistik"** → `/{slug}/statistik`

---

## 9. Status Implementasi

| Halaman | Status |
|---------|--------|
| Direktori Anggota (`/anggota`) | ✅ Selesai |
| Popup detail anggota | ✅ Selesai |
| API `/api/member-public/[id]` | ✅ Selesai |
| Direktori Pesantren (`/pesantren`) | ✅ Selesai |
| Detail Pesantren (`/pesantren/[id]`) | ✅ Selesai |
| Direktori Usaha (`/usaha`) | ✅ Selesai |
| Detail Usaha (`/usaha/[id]`) | ✅ Selesai |
| Statistik (`/statistik`) | ✅ Selesai |

Semua halaman selesai. TypeScript 0 errors. Commit: `feat: direktori publik anggota + pesantren + usaha + statistik`.
